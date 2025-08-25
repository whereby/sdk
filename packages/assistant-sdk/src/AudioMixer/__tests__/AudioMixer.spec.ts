import { AudioMixer } from "..";
import { RemoteParticipantState } from "@whereby.com/core";
import { ChildProcessWithoutNullStreams } from "child_process";
import {
    spawnFFmpegProcess,
    spawnFFmpegProcessDebug,
    stopFFmpegProcess,
    writeAudioDataToFFmpeg,
    clearSlotQueue,
    PARTICIPANT_SLOTS,
} from "../../utils/ffmpeg-helpers";

jest.mock("../../utils/ffmpeg-helpers", () => ({
    spawnFFmpegProcess: jest.fn(),
    spawnFFmpegProcessDebug: jest.fn(),
    stopFFmpegProcess: jest.fn(),
    writeAudioDataToFFmpeg: jest.fn(),
    clearSlotQueue: jest.fn(),
    PARTICIPANT_SLOTS: 20,
}));

jest.mock("@roamhq/wrtc", () => ({
    MediaStream: jest.fn().mockImplementation((tracks) => ({
        getTracks: () => tracks || [],
        addTrack: jest.fn(),
        removeTrack: jest.fn(),
    })),
    nonstandard: {
        RTCAudioSource: jest.fn().mockImplementation(() => ({
            createTrack: jest.fn().mockReturnValue({
                id: "mock-track-id",
                kind: "audio",
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            }),
        })),
    },
}));

const mockFFmpegProcess = {
    kill: jest.fn(),
    stdio: Array(23).fill({ write: jest.fn(), end: jest.fn() }),
} as unknown as ChildProcessWithoutNullStreams;

const mockSlotBinding = {
    sink: {},
    writer: { write: jest.fn(), end: jest.fn() },
    stop: jest.fn(),
    trackId: "track-123",
};

const createMockParticipant = (
    id: string,
    isAudioEnabled = true,
    hasStream = true,
    trackId = "track-123",
): RemoteParticipantState => ({
    id,
    displayName: `Participant ${id}`,
    deviceId: "device-123",
    roleName: "visitor",
    isAudioEnabled,
    isVideoEnabled: true,
    isLocalParticipant: false,
    breakoutGroup: null,
    stream: hasStream
        ? ({
              getTracks: () => [
                  {
                      id: trackId,
                      kind: "audio",
                      addEventListener: jest.fn(),
                      removeEventListener: jest.fn(),
                  },
              ],
          } as unknown as MediaStream)
        : null,
    presentationStream: null,
    externalId: null,
    isDialIn: false,
});

describe("AudioMixer", () => {
    let audioMixer: AudioMixer;
    let onStreamReady: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        onStreamReady = jest.fn();

        (spawnFFmpegProcess as jest.Mock).mockReturnValue(mockFFmpegProcess);
        (spawnFFmpegProcessDebug as jest.Mock).mockReturnValue(mockFFmpegProcess);
        (writeAudioDataToFFmpeg as jest.Mock).mockReturnValue(mockSlotBinding);

        audioMixer = new AudioMixer(onStreamReady);
    });

    describe("constructor", () => {
        it("should create a new AudioMixer instance", () => {
            expect(audioMixer).toBeDefined();
            expect(audioMixer).toBeInstanceOf(AudioMixer);
        });

        it("should initialize with a combined audio stream", () => {
            const stream = audioMixer.getCombinedAudioStream();
            expect(stream).toBeDefined();
        });

        it("should store the onStreamReady callback", () => {
            expect(onStreamReady).not.toHaveBeenCalled();
        });
    });

    describe("getCombinedAudioStream", () => {
        it("should return the combined audio stream", () => {
            const stream = audioMixer.getCombinedAudioStream();
            expect(stream).toBeDefined();
        });

        it("should return null after stopping the mixer", () => {
            audioMixer.stopAudioMixer();
            const stream = audioMixer.getCombinedAudioStream();
            expect(stream).toBeDefined(); // It recreates the stream
        });
    });

    describe("handleRemoteParticipants", () => {
        it("should stop mixer when no participants", () => {
            audioMixer.handleRemoteParticipants([]);
            expect(stopFFmpegProcess).not.toHaveBeenCalled(); // No process started yet
        });

        it("should spawn FFmpeg process for first participant", () => {
            const participant = createMockParticipant("p1");
            audioMixer.handleRemoteParticipants([participant]);

            expect(spawnFFmpegProcess).toHaveBeenCalledWith(expect.any(Object), onStreamReady);
        });

        it("should spawn debug FFmpeg process when DEBUG_MIXER_OUTPUT is true", () => {
            const participant = createMockParticipant("p1");
            audioMixer.handleRemoteParticipants([participant]);

            expect(spawnFFmpegProcess).toHaveBeenCalled();
        });

        it("should attach participants with audio tracks", () => {
            const participant = createMockParticipant("p1");
            audioMixer.handleRemoteParticipants([participant]);

            expect(writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: "track-123", kind: "audio" }),
            );
        });

        it("should not attach participants without audio enabled", () => {
            const participant = createMockParticipant("p1", false);
            audioMixer.handleRemoteParticipants([participant]);

            expect(writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should not attach participants without stream", () => {
            const participant = createMockParticipant("p1", true, false);
            audioMixer.handleRemoteParticipants([participant]);

            expect(writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should not attach participants without audio track", () => {
            const participant = createMockParticipant("p1");
            participant.stream = {
                getTracks: () => [{ id: "video-track", kind: "video" }],
            } as unknown as MediaStream;
            audioMixer.handleRemoteParticipants([participant]);

            expect(writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should detach participants that are no longer present", () => {
            const participant1 = createMockParticipant("p1");
            const participant2 = createMockParticipant("p2");
            audioMixer.handleRemoteParticipants([participant1, participant2]);

            expect(writeAudioDataToFFmpeg).toHaveBeenCalledTimes(2);

            audioMixer.handleRemoteParticipants([participant1]);

            expect(clearSlotQueue).toHaveBeenCalledWith(1);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should handle multiple participants", () => {
            const participants = [
                createMockParticipant("p1", true, true, "track-1"),
                createMockParticipant("p2", true, true, "track-2"),
                createMockParticipant("p3", true, true, "track-3"),
            ];

            audioMixer.handleRemoteParticipants(participants);

            expect(writeAudioDataToFFmpeg).toHaveBeenCalledTimes(3);
            expect(writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: "track-1" }),
            );
            expect(writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                1,
                expect.objectContaining({ id: "track-2" }),
            );
            expect(writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                2,
                expect.objectContaining({ id: "track-3" }),
            );
        });

        it("should reuse existing slot for same participant", () => {
            const participant = createMockParticipant("p1");

            audioMixer.handleRemoteParticipants([participant]);
            audioMixer.handleRemoteParticipants([participant]);

            expect(writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);
        });

        it("should handle participant track changes", () => {
            const participant1 = createMockParticipant("p1", true, true, "track-1");
            audioMixer.handleRemoteParticipants([participant1]);

            const participant2 = createMockParticipant("p1", true, true, "track-2");
            audioMixer.handleRemoteParticipants([participant2]);

            expect(mockSlotBinding.stop).toHaveBeenCalled();
            expect(writeAudioDataToFFmpeg).toHaveBeenCalledTimes(2);
        });

        it("should handle up to PARTICIPANT_SLOTS participants", () => {
            const participants = Array.from({ length: PARTICIPANT_SLOTS + 5 }, (_, i) =>
                createMockParticipant(`p${i}`, true, true, `track-${i}`),
            );

            audioMixer.handleRemoteParticipants(participants);

            expect(writeAudioDataToFFmpeg).toHaveBeenCalledTimes(PARTICIPANT_SLOTS);
        });
    });

    describe("stopAudioMixer", () => {
        it("should stop FFmpeg process if running", () => {
            const participant = createMockParticipant("p1");
            audioMixer.handleRemoteParticipants([participant]);

            audioMixer.stopAudioMixer();

            expect(stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
        });

        it("should clear all participant slots", () => {
            const participants = [createMockParticipant("p1"), createMockParticipant("p2")];
            audioMixer.handleRemoteParticipants(participants);

            audioMixer.stopAudioMixer();

            const newParticipant = createMockParticipant("p3");
            audioMixer.handleRemoteParticipants([newParticipant]);

            expect(writeAudioDataToFFmpeg).toHaveBeenLastCalledWith(expect.any(Object), 0, expect.any(Object));
        });

        it("should recreate media stream", () => {
            const streamBefore = audioMixer.getCombinedAudioStream();
            audioMixer.stopAudioMixer();
            const streamAfter = audioMixer.getCombinedAudioStream();

            expect(streamAfter).toBeDefined();
            expect(streamAfter).not.toBe(streamBefore);
        });

        it("should handle being called when no FFmpeg process is running", () => {
            expect(() => audioMixer.stopAudioMixer()).not.toThrow();
        });
    });

    describe("error handling", () => {
        it("should handle writeAudioDataToFFmpeg throwing", () => {
            const error = new Error("FFmpeg write failed");
            (writeAudioDataToFFmpeg as jest.Mock).mockImplementationOnce(() => {
                throw error;
            });

            const participant = createMockParticipant("p1");

            expect(() => audioMixer.handleRemoteParticipants([participant])).toThrow("FFmpeg write failed");
        });

        it("should handle stop() throwing on slot binding", () => {
            const participant1 = createMockParticipant("p1");
            const participant2 = createMockParticipant("p2");
            const faultyBinding = {
                ...mockSlotBinding,
                stop: jest.fn().mockImplementation(() => {
                    throw new Error("Stop failed");
                }),
            };

            audioMixer.handleRemoteParticipants([participant1]);

            (writeAudioDataToFFmpeg as jest.Mock).mockReturnValue(faultyBinding);
            audioMixer.handleRemoteParticipants([participant1, participant2]);

            expect(() => audioMixer.handleRemoteParticipants([participant1])).not.toThrow();
            expect(faultyBinding.stop).toHaveBeenCalled();
        });
    });

    describe("slot management", () => {
        it("should allocate slots sequentially", () => {
            const participants = [
                createMockParticipant("p1"),
                createMockParticipant("p2"),
                createMockParticipant("p3"),
            ];

            audioMixer.handleRemoteParticipants(participants);

            expect(writeAudioDataToFFmpeg).toHaveBeenCalledWith(mockFFmpegProcess, 0, expect.any(Object));
            expect(writeAudioDataToFFmpeg).toHaveBeenCalledWith(mockFFmpegProcess, 1, expect.any(Object));
            expect(writeAudioDataToFFmpeg).toHaveBeenCalledWith(mockFFmpegProcess, 2, expect.any(Object));
        });

        it("should reuse slots when participants leave", () => {
            const participants = [
                createMockParticipant("p1"),
                createMockParticipant("p2"),
                createMockParticipant("p3"),
            ];
            audioMixer.handleRemoteParticipants(participants);

            audioMixer.handleRemoteParticipants([participants[0], participants[2]]);

            const newParticipant = createMockParticipant("p4");
            audioMixer.handleRemoteParticipants([participants[0], participants[2], newParticipant]);

            expect(clearSlotQueue).toHaveBeenCalledWith(1);
        });
    });
});
