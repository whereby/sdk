import { AudioMixer } from "..";
import { RemoteParticipantState, ScreenshareState } from "@whereby.com/core";
import { ChildProcessWithoutNullStreams } from "child_process";
import { createFfmpegMixer, MIXER_SLOTS } from "../../utils/ffmpeg-helpers";

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

const mixerInstance = {
    spawnFFmpegProcess: jest.fn().mockReturnValue(mockFFmpegProcess),
    spawnFFmpegProcessDebug: jest.fn().mockReturnValue(mockFFmpegProcess),
    stopFFmpegProcess: jest.fn(),
    writeAudioDataToFFmpeg: jest.fn().mockReturnValue(mockSlotBinding),
    clearSlotQueue: jest.fn(),
};

const mockCombinedAudioTrack = {
    id: "mock-track-id",
    kind: "audio",
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    stop: jest.fn(),
};

jest.mock("../../utils/ffmpeg-helpers", () => ({
    createFfmpegMixer: jest.fn(() => mixerInstance),
    MIXER_SLOTS: 20,
}));

jest.mock("@roamhq/wrtc", () => ({
    MediaStream: jest.fn().mockImplementation((tracks) => ({
        getTracks: () => tracks || [],
        addTrack: jest.fn(),
        removeTrack: jest.fn(),
    })),
    nonstandard: {
        RTCAudioSource: jest.fn().mockImplementation(() => ({
            createTrack: jest.fn().mockReturnValue(mockCombinedAudioTrack),
        })),
    },
}));

// moved above to be used in mixer mock

const createMockParticipant = ({
    id,
    isAudioEnabled = true,
    hasStream = true,
    trackId = "track-123",
}: {
    id: string;
    isAudioEnabled?: boolean;
    hasStream?: boolean;
    trackId?: string;
}): RemoteParticipantState => ({
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

const createMockScreenshare = ({
    id,
    hasAudioTrackStateFlag = true,
    hasStream = true,
    trackId = "track-123",
    hasAudioTrack = true,
}: {
    id: string;
    hasAudioTrackStateFlag?: boolean;
    hasStream?: boolean;
    trackId?: string;
    hasAudioTrack?: boolean;
}): ScreenshareState => ({
    id,
    participantId: "some-participant",
    hasAudioTrack: hasAudioTrackStateFlag,
    breakoutGroup: null,
    stream: hasStream
        ? ({
              getTracks: () =>
                  hasAudioTrack
                      ? [
                            {
                                id: trackId,
                                kind: "audio",
                                addEventListener: jest.fn(),
                                removeEventListener: jest.fn(),
                            },
                        ]
                      : [],
          } as unknown as MediaStream)
        : undefined,
    isLocal: false,
});

describe("AudioMixer", () => {
    let audioMixer: AudioMixer;

    beforeEach(() => {
        jest.clearAllMocks();

        (createFfmpegMixer as jest.Mock).mockReturnValue(mixerInstance);
        mixerInstance.spawnFFmpegProcess.mockClear();
        mixerInstance.spawnFFmpegProcessDebug.mockClear();
        mixerInstance.writeAudioDataToFFmpeg.mockClear();
        mixerInstance.stopFFmpegProcess.mockClear();
        mixerInstance.clearSlotQueue.mockClear();

        audioMixer = new AudioMixer();
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
        it("should not stop mixer when no participants", () => {
            audioMixer.handleRemoteParticipants([]);
            expect(mixerInstance.stopFFmpegProcess).not.toHaveBeenCalled(); // No process started yet
        });

        it("should spawn FFmpeg process for first participant", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.spawnFFmpegProcess).toHaveBeenCalledWith(expect.any(Object));
        });

        it("should not stop mixer when all participants leave", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            audioMixer.handleRemoteParticipants([]);
            expect(mixerInstance.stopFFmpegProcess).not.toHaveBeenCalled();
        });

        it("should spawn debug FFmpeg process when DEBUG_MIXER_OUTPUT is true", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.spawnFFmpegProcess).toHaveBeenCalled();
        });

        it("should attach participants with audio tracks", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: "track-123", kind: "audio" }),
            );
        });

        it("should not attach participants without audio enabled", () => {
            const participant = createMockParticipant({ id: "p1", isAudioEnabled: false });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should not attach participants without stream", () => {
            const participant = createMockParticipant({ id: "p1", hasStream: false });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should not attach participants without audio track", () => {
            const participant = createMockParticipant({ id: "p1" });
            participant.stream = {
                getTracks: () => [{ id: "video-track", kind: "video" }],
            } as unknown as MediaStream;
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should detach participants that are no longer present", () => {
            const participant1 = createMockParticipant({ id: "p1" });
            const participant2 = createMockParticipant({ id: "p2" });
            audioMixer.handleRemoteParticipants([participant1, participant2]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(2);

            audioMixer.handleRemoteParticipants([participant1]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(1);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should detach participants with audio diabled", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);

            participant.isAudioEnabled = false;
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should detach participants with no audio track", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);

            participant.stream = { getTracks: () => [{ id: "video-track", kind: "video" }] } as unknown as MediaStream;
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should detach participants with no stream", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);

            participant.stream = null;
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should handle multiple participants", () => {
            const participants = [
                createMockParticipant({ id: "p1", trackId: "track-1" }),
                createMockParticipant({ id: "p2", trackId: "track-2" }),
                createMockParticipant({ id: "p3", trackId: "track-3" }),
            ];

            audioMixer.handleRemoteParticipants(participants);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(3);
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: "track-1" }),
            );
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                1,
                expect.objectContaining({ id: "track-2" }),
            );
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                2,
                expect.objectContaining({ id: "track-3" }),
            );
        });

        it("should reuse existing slot for same participant", () => {
            const participant = createMockParticipant({ id: "p1" });

            audioMixer.handleRemoteParticipants([participant]);
            audioMixer.handleRemoteParticipants([participant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);
        });

        it("should handle participant track changes", () => {
            const participant1 = createMockParticipant({ id: "p1", trackId: "track-1" });
            audioMixer.handleRemoteParticipants([participant1]);

            const participant2 = createMockParticipant({ id: "p1", trackId: "track-2" });
            audioMixer.handleRemoteParticipants([participant2]);

            expect(mockSlotBinding.stop).toHaveBeenCalled();
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(2);
        });

        it("should handle up to MIXER_SLOTS participants", () => {
            const participants = Array.from({ length: MIXER_SLOTS + 5 }, (_, i) =>
                createMockParticipant({ id: `p${i}`, trackId: `track-${i}` }),
            );

            audioMixer.handleRemoteParticipants(participants);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(MIXER_SLOTS);
        });

        it("should free slots before trying to assign to new participants", () => {
            const participants = Array.from({ length: MIXER_SLOTS }, (_, i) =>
                createMockParticipant({
                    id: `p${i}`,
                    trackId: `track-${i}`,
                }),
            );

            audioMixer.handleRemoteParticipants(participants);

            participants.shift();
            const newScreenshare = createMockParticipant({
                id: `p${MIXER_SLOTS + 1}`,
                trackId: `track-${MIXER_SLOTS + 1}`,
            });
            participants.push(newScreenshare);

            audioMixer.handleRemoteParticipants(participants);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: `track-${MIXER_SLOTS + 1}`, kind: "audio" }),
            );
        });
    });

    describe("handleScreenshares", () => {
        it("should not stop mixer when no screenshares", () => {
            audioMixer.handleScreenshares([]);

            expect(mixerInstance.stopFFmpegProcess).not.toHaveBeenCalled(); // No process started yet
        });

        it("should spawn FFmpeg process for first screenshare", () => {
            const screenshare = createMockScreenshare({ id: "s1" });
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.spawnFFmpegProcess).toHaveBeenCalledWith(expect.any(Object));
        });

        it("should not stop mixer when all screenshares leave", () => {
            const screenshare = createMockScreenshare({ id: "s1" });
            audioMixer.handleScreenshares([screenshare]);

            audioMixer.handleScreenshares([]);
            expect(mixerInstance.stopFFmpegProcess).not.toHaveBeenCalled();
        });

        it("should attach screenshares with audio tracks", () => {
            const screenshare = createMockScreenshare({ id: "s1" });
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: "track-123", kind: "audio" }),
            );
        });

        it("should not attach screenshares without audio enabled", () => {
            const screenshare = createMockScreenshare({ id: "s1", hasAudioTrack: false });
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should not attach screenshares without stream", () => {
            const screenshare = createMockScreenshare({ id: "s1", hasStream: false });
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should not attach screenshares without audio track", () => {
            const screenshare = createMockScreenshare({ id: "s1" });
            screenshare.stream = {
                getTracks: () => [{ id: "video-track", kind: "video" }],
            } as unknown as MediaStream;
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).not.toHaveBeenCalled();
        });

        it("should detach screenshares that are no longer present", () => {
            const screenshare1 = createMockScreenshare({ id: "s1" });
            const screenshare2 = createMockScreenshare({ id: "s2" });
            audioMixer.handleScreenshares([screenshare1, screenshare2]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(2);

            audioMixer.handleScreenshares([screenshare1]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(1);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should detach screenshares with audio diabled", () => {
            const screenshare = createMockScreenshare({ id: "s1" });
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);

            screenshare.hasAudioTrack = false;
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should detach screenshares with no audio track", () => {
            const screenshare = createMockScreenshare({ id: "s1" });
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);

            screenshare.stream = { getTracks: () => [{ id: "video-track", kind: "video" }] } as unknown as MediaStream;
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should detach screenshares with no stream", () => {
            const screenshare = createMockScreenshare({ id: "s1" });
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);

            screenshare.stream = undefined;
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mockSlotBinding.stop).toHaveBeenCalled();
        });

        it("should handle multiple screenshares", () => {
            const screenshares = [
                createMockScreenshare({ id: "s1", trackId: "track-1" }),
                createMockScreenshare({ id: "s2", trackId: "track-2" }),
                createMockScreenshare({ id: "s3", trackId: "track-3" }),
            ];

            audioMixer.handleScreenshares(screenshares);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(3);
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: "track-1" }),
            );
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                1,
                expect.objectContaining({ id: "track-2" }),
            );
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                2,
                expect.objectContaining({ id: "track-3" }),
            );
        });

        it("should reuse existing slot for same screenshare", () => {
            const screenshare = createMockScreenshare({ id: "s1" });

            audioMixer.handleScreenshares([screenshare]);
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(1);
        });

        it("should handle screenshare track changes", () => {
            const screenshare1 = createMockScreenshare({ id: "s1", trackId: "track-1" });
            audioMixer.handleScreenshares([screenshare1]);

            const screenshare2 = createMockScreenshare({ id: "s1", trackId: "track-2" });
            audioMixer.handleScreenshares([screenshare2]);

            expect(mockSlotBinding.stop).toHaveBeenCalled();
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(2);
        });

        it("should handle up to MIXER_SLOTS screenshares", () => {
            const screenshares = Array.from({ length: MIXER_SLOTS + 5 }, (_, i) =>
                createMockScreenshare({ id: `s${i}`, trackId: `track-${i}` }),
            );

            audioMixer.handleScreenshares(screenshares);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(MIXER_SLOTS);
        });

        it("should free slots before trying to assign to new screenshares", () => {
            const screenshares = Array.from({ length: MIXER_SLOTS }, (_, i) =>
                createMockScreenshare({
                    id: `s${i}`,
                    trackId: `track-${i}`,
                }),
            );

            audioMixer.handleScreenshares(screenshares);

            screenshares.shift();
            const newScreenshare = createMockScreenshare({
                id: `s${MIXER_SLOTS + 1}`,
                trackId: `track-${MIXER_SLOTS + 1}`,
            });
            screenshares.push(newScreenshare);

            audioMixer.handleScreenshares(screenshares);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(0);
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(
                mockFFmpegProcess,
                0,
                expect.objectContaining({ id: `track-${MIXER_SLOTS + 1}`, kind: "audio" }),
            );
        });
    });

    describe("when mixing screenshares and participants", () => {
        it("should respect the slot limit", () => {
            const participants = Array.from({ length: MIXER_SLOTS / 2 }, (_, i) =>
                createMockParticipant({ id: `p${i}`, trackId: `track-${i}` }),
            );
            const screenshares = Array.from({ length: MIXER_SLOTS / 2 }, (_, i) =>
                createMockScreenshare({ id: `s${i}`, trackId: `track-${i}` }),
            );

            const extraScreenshare = createMockScreenshare({
                id: `s${MIXER_SLOTS / 2 + 1}`,
                trackId: `track-${MIXER_SLOTS / 2 + 1}`,
            });
            const extraParticipant = createMockParticipant({
                id: `s${MIXER_SLOTS / 2 + 1}`,
                trackId: `track-${MIXER_SLOTS / 2 + 1}`,
            });
            audioMixer.handleScreenshares([...screenshares, extraScreenshare]);
            audioMixer.handleRemoteParticipants([...participants, extraParticipant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(MIXER_SLOTS);
            expect(mixerInstance.clearSlotQueue).not.toHaveBeenCalled();
        });

        it("should not detatch participants when adding screenshares", () => {
            const participants = Array.from({ length: MIXER_SLOTS - 1 }, (_, i) =>
                createMockParticipant({ id: `p${i}`, trackId: `track-${i}` }),
            );
            const screenshare = createMockScreenshare({
                id: "s1",
                trackId: "track-1",
            });

            audioMixer.handleRemoteParticipants(participants);
            audioMixer.handleScreenshares([screenshare]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(MIXER_SLOTS);
            expect(mixerInstance.clearSlotQueue).not.toHaveBeenCalled();
        });

        it("should not detatch screenshares when adding participants", () => {
            const screenshares = Array.from({ length: MIXER_SLOTS - 1 }, (_, i) =>
                createMockScreenshare({ id: `p${i}`, trackId: `track-${i}` }),
            );
            const participant = createMockParticipant({
                id: "s1",
                trackId: "track-1",
            });

            audioMixer.handleRemoteParticipants([participant]);
            audioMixer.handleScreenshares(screenshares);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(MIXER_SLOTS);
            expect(mixerInstance.clearSlotQueue).not.toHaveBeenCalled();
        });

        it("should not detatch participants when detatching screenshares", () => {
            const participant = createMockParticipant({ id: "p1" });
            const screenshare = createMockScreenshare({ id: "s1" });

            audioMixer.handleRemoteParticipants([participant]);
            audioMixer.handleScreenshares([screenshare]);
            audioMixer.handleScreenshares([]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(2);
            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledTimes(1);
        });

        it("should not detatch screenshares when detatching participants", () => {
            const participant1 = createMockParticipant({ id: "p1" });
            const participant2 = createMockParticipant({ id: "p2" });
            const screenshare = createMockScreenshare({ id: "s1" });

            audioMixer.handleRemoteParticipants([participant1, participant2]);
            audioMixer.handleScreenshares([screenshare]);
            audioMixer.handleRemoteParticipants([participant1]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledTimes(3);
            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledTimes(1);
        });
    });

    describe("stopAudioMixer", () => {
        it("should stop FFmpeg process if running", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            audioMixer.stopAudioMixer();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
        });

        it("should stop all active slots", () => {
            const participant1 = createMockParticipant({ id: "p1" });
            const participant2 = createMockParticipant({ id: "p2" });
            const screenshare1 = createMockScreenshare({ id: "s1" });
            const screenshare2 = createMockScreenshare({ id: "s2" });
            audioMixer.handleRemoteParticipants([participant1, participant2]);
            audioMixer.handleScreenshares([screenshare1, screenshare2]);

            audioMixer.stopAudioMixer();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
            expect(mockSlotBinding.stop).toHaveBeenCalledTimes(4);
        });

        it("should stop the combined audio stream tracks", () => {
            audioMixer.stopAudioMixer();

            expect(mockCombinedAudioTrack.stop).toHaveBeenCalled();
        });

        it("should clear all participant slots", () => {
            const participants = [createMockParticipant({ id: "p1" }), createMockParticipant({ id: "p2" })];
            audioMixer.handleRemoteParticipants(participants);

            audioMixer.stopAudioMixer();

            const newParticipant = createMockParticipant({ id: "p3" });
            audioMixer.handleRemoteParticipants([newParticipant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenLastCalledWith(
                expect.any(Object),
                0,
                expect.any(Object),
            );
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

    describe("destroy", () => {
        it("should stop FFmpeg process if running", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            audioMixer.destroy();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
        });

        it("should stop all active slots", () => {
            const participant1 = createMockParticipant({ id: "p1" });
            const participant2 = createMockParticipant({ id: "p2" });
            const screenshare1 = createMockScreenshare({ id: "s1" });
            const screenshare2 = createMockScreenshare({ id: "s2" });
            audioMixer.handleRemoteParticipants([participant1, participant2]);
            audioMixer.handleScreenshares([screenshare1, screenshare2]);

            audioMixer.destroy();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
            expect(mockSlotBinding.stop).toHaveBeenCalledTimes(4);
        });

        it("should stop the combined audio stream tracks", () => {
            audioMixer.destroy();

            expect(mockCombinedAudioTrack.stop).toHaveBeenCalled();
        });

        it("should clear all participant slots", () => {
            const participants = [createMockParticipant({ id: "p1" }), createMockParticipant({ id: "p2" })];
            audioMixer.handleRemoteParticipants(participants);

            audioMixer.destroy();

            const newParticipant = createMockParticipant({ id: "p3" });
            audioMixer.handleRemoteParticipants([newParticipant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenLastCalledWith(
                expect.any(Object),
                0,
                expect.any(Object),
            );
        });

        it("should not recreate media stream", () => {
            const streamBefore = audioMixer.getCombinedAudioStream();
            audioMixer.destroy();
            const streamAfter = audioMixer.getCombinedAudioStream();

            expect(streamBefore).toBeDefined();
            expect(streamAfter).toEqual(null);
        });

        it("should handle being called when no FFmpeg process is running", () => {
            expect(() => audioMixer.destroy()).not.toThrow();
        });
    });

    describe("destroy", () => {
        it("should stop FFmpeg process if running", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            audioMixer.destroy();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
        });

        it("should stop all active slots", () => {
            const participant1 = createMockParticipant({ id: "p1" });
            const participant2 = createMockParticipant({ id: "p2" });
            const screenshare1 = createMockScreenshare({ id: "s1" });
            const screenshare2 = createMockScreenshare({ id: "s2" });
            audioMixer.handleRemoteParticipants([participant1, participant2]);
            audioMixer.handleScreenshares([screenshare1, screenshare2]);

            audioMixer.destroy();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
            expect(mockSlotBinding.stop).toHaveBeenCalledTimes(4);
        });

        it("should stop the combined audio stream tracks", () => {
            audioMixer.destroy();

            expect(mockCombinedAudioTrack.stop).toHaveBeenCalled();
        });

        it("should clear all participant slots", () => {
            const participants = [createMockParticipant({ id: "p1" }), createMockParticipant({ id: "p2" })];
            audioMixer.handleRemoteParticipants(participants);

            audioMixer.destroy();

            const newParticipant = createMockParticipant({ id: "p3" });
            audioMixer.handleRemoteParticipants([newParticipant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenLastCalledWith(
                expect.any(Object),
                0,
                expect.any(Object),
            );
        });

        it("should not recreate media stream", () => {
            const streamBefore = audioMixer.getCombinedAudioStream();
            audioMixer.destroy();
            const streamAfter = audioMixer.getCombinedAudioStream();

            expect(streamBefore).toBeDefined();
            expect(streamAfter).toEqual(null);
        });

        it("should handle being called when no FFmpeg process is running", () => {
            expect(() => audioMixer.destroy()).not.toThrow();
        });
    });

    describe("destroy", () => {
        it("should stop FFmpeg process if running", () => {
            const participant = createMockParticipant({ id: "p1" });
            audioMixer.handleRemoteParticipants([participant]);

            audioMixer.destroy();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
        });

        it("should stop all active slots", () => {
            const participant1 = createMockParticipant({ id: "p1" });
            const participant2 = createMockParticipant({ id: "p2" });
            const screenshare1 = createMockScreenshare({ id: "s1" });
            const screenshare2 = createMockScreenshare({ id: "s2" });
            audioMixer.handleRemoteParticipants([participant1, participant2]);
            audioMixer.handleScreenshares([screenshare1, screenshare2]);

            audioMixer.destroy();

            expect(mixerInstance.stopFFmpegProcess).toHaveBeenCalledWith(mockFFmpegProcess);
            expect(mockSlotBinding.stop).toHaveBeenCalledTimes(4);
        });

        it("should stop the combined audio stream tracks", () => {
            audioMixer.destroy();

            expect(mockCombinedAudioTrack.stop).toHaveBeenCalled();
        });

        it("should clear all participant slots", () => {
            const participants = [createMockParticipant({ id: "p1" }), createMockParticipant({ id: "p2" })];
            audioMixer.handleRemoteParticipants(participants);

            audioMixer.destroy();

            const newParticipant = createMockParticipant({ id: "p3" });
            audioMixer.handleRemoteParticipants([newParticipant]);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenLastCalledWith(
                expect.any(Object),
                0,
                expect.any(Object),
            );
        });

        it("should not recreate media stream", () => {
            const streamBefore = audioMixer.getCombinedAudioStream();
            audioMixer.destroy();
            const streamAfter = audioMixer.getCombinedAudioStream();

            expect(streamBefore).toBeDefined();
            expect(streamAfter).toEqual(null);
        });

        it("should handle being called when no FFmpeg process is running", () => {
            expect(() => audioMixer.destroy()).not.toThrow();
        });
    });

    describe("error handling", () => {
        it("should handle writeAudioDataToFFmpeg throwing", () => {
            const error = new Error("FFmpeg write failed");
            (mixerInstance.writeAudioDataToFFmpeg as jest.Mock).mockImplementationOnce(() => {
                throw error;
            });

            const participant = createMockParticipant({ id: "p1" });

            expect(() => audioMixer.handleRemoteParticipants([participant])).toThrow("FFmpeg write failed");
        });

        it("should handle stop() throwing on slot binding", () => {
            const participant1 = createMockParticipant({ id: "p1" });
            const participant2 = createMockParticipant({ id: "p2" });
            const faultyBinding = {
                ...mockSlotBinding,
                stop: jest.fn().mockImplementation(() => {
                    throw new Error("Stop failed");
                }),
            };

            audioMixer.handleRemoteParticipants([participant1]);

            (mixerInstance.writeAudioDataToFFmpeg as jest.Mock).mockReturnValue(faultyBinding);
            audioMixer.handleRemoteParticipants([participant1, participant2]);

            expect(() => audioMixer.handleRemoteParticipants([participant1])).not.toThrow();
            expect(faultyBinding.stop).toHaveBeenCalled();
        });
    });

    describe("slot management", () => {
        it("should allocate slots sequentially", () => {
            const participants = [
                createMockParticipant({ id: "p1" }),
                createMockParticipant({ id: "p2" }),
                createMockParticipant({ id: "p3" }),
            ];

            audioMixer.handleRemoteParticipants(participants);

            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(mockFFmpegProcess, 0, expect.any(Object));
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(mockFFmpegProcess, 1, expect.any(Object));
            expect(mixerInstance.writeAudioDataToFFmpeg).toHaveBeenCalledWith(mockFFmpegProcess, 2, expect.any(Object));
        });

        it("should reuse slots when participants leave", () => {
            const participants = [
                createMockParticipant({ id: "p1" }),
                createMockParticipant({ id: "p2" }),
                createMockParticipant({ id: "p3" }),
            ];
            audioMixer.handleRemoteParticipants(participants);

            audioMixer.handleRemoteParticipants([participants[0], participants[2]]);

            const newParticipant = createMockParticipant({ id: "p4" });
            audioMixer.handleRemoteParticipants([participants[0], participants[2], newParticipant]);

            expect(mixerInstance.clearSlotQueue).toHaveBeenCalledWith(1);
        });
    });
});
