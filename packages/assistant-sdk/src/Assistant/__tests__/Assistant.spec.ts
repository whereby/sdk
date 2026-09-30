import { ConnectionStatus, RemoteParticipantState } from "@whereby.com/core";
import { Assistant } from "..";
import { AudioMixer } from "../../AudioMixer";

const connectionStatusSubscribers = new Set<(status: ConnectionStatus) => void>();
const remoteParticipantsSubscribers = new Set<(participants: RemoteParticipantState[]) => void>();

const mockRoomConnection = {
    subscribeToConnectionStatus: jest.fn((cb: (status: ConnectionStatus) => void) => {
        connectionStatusSubscribers.add(cb);
        return () => connectionStatusSubscribers.delete(cb);
    }),
    subscribeToRemoteParticipants: jest.fn((cb: (participants: RemoteParticipantState[]) => void) => {
        remoteParticipantsSubscribers.add(cb);
        return () => remoteParticipantsSubscribers.delete(cb);
    }),
};

jest.mock("@whereby.com/core", () => ({
    WherebyClient: jest.fn().mockImplementation(() => ({
        getRoomConnection: () => mockRoomConnection,
        getLocalMedia: () => ({}),
    })),
}));

const mockSinkStop = jest.fn();

jest.mock("../../utils/AudioEndpoints", () => ({
    AudioSource: jest.fn(),
    AudioSink: jest.fn().mockImplementation(() => ({ stop: mockSinkStop })),
}));

jest.mock("../../utils/VideoEndpoints", () => ({
    VideoSource: jest.fn(),
    VideoSink: jest.fn(),
}));

jest.mock("@roamhq/wrtc", () => ({ MediaStream: jest.fn() }));

jest.mock("../../AudioMixer", () => ({
    AudioMixer: jest.fn().mockImplementation(() => ({
        getCombinedAudioStream: () => ({ getAudioTracks: () => [{ id: "mixed-track" }] }),
        handleRemoteParticipants: jest.fn(),
        stopAudioMixer: jest.fn(),
    })),
}));

const setConnectionStatus = (status: ConnectionStatus) => {
    [...connectionStatusSubscribers].forEach((cb) => cb(status));
};

describe("Assistant", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        connectionStatusSubscribers.clear();
        remoteParticipantsSubscribers.clear();
    });

    describe("getCombinedAudioSink", () => {
        it("should return the same sink on repeated calls", () => {
            const assistant = new Assistant({ assistantKey: "key" });

            expect(assistant.getCombinedAudioSink()).toBe(assistant.getCombinedAudioSink());
            expect(AudioMixer).toHaveBeenCalledTimes(1);
        });

        it.each<ConnectionStatus>(["left", "kicked"])("should stop the mixer and sink when %s", (status) => {
            const assistant = new Assistant({ assistantKey: "key" });
            assistant.getCombinedAudioSink();
            const mixer = jest.mocked(AudioMixer).mock.results[0].value;

            setConnectionStatus(status);

            expect(mixer.stopAudioMixer).toHaveBeenCalledTimes(1);
            expect(mockSinkStop).toHaveBeenCalledTimes(1);
            expect(remoteParticipantsSubscribers.size).toBe(0);
        });

        it("should create a new mixer when called after leaving", () => {
            const assistant = new Assistant({ assistantKey: "key" });
            const firstSink = assistant.getCombinedAudioSink();

            setConnectionStatus("left");

            expect(assistant.getCombinedAudioSink()).not.toBe(firstSink);
            expect(AudioMixer).toHaveBeenCalledTimes(2);
        });
    });
});
