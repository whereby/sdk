import { doEnableAudio, doEnableVideo, doSetDisplayName } from "../../slices/localParticipant";
import { initialLocalMediaState, toggleCameraEnabled, toggleMicrophoneEnabled } from "../../slices/localMedia";
import { signalEvents } from "../../slices/signalConnection/actions";
import { randomSignalClient } from "../../../__mocks__/appMocks";
import { createStore, mockSignalEmit } from "../store.setup";

const flushMicrotasks = async () => {
    for (let i = 0; i < 30; i++) {
        await Promise.resolve();
    }
};

describe("actions", () => {
    it("doEnableAudio", async () => {
        const store = createStore({
            withSignalConnection: true,
            connectToRoom: true,
        });

        await store.dispatch(doEnableAudio({ enabled: true }));

        expect(mockSignalEmit).toHaveBeenCalledWith("enable_audio", { enabled: true });
    });

    it("doEnableVideo", async () => {
        const store = createStore({
            withSignalConnection: true,
            connectToRoom: true,
        });

        await store.dispatch(doEnableVideo({ enabled: true }));

        expect(mockSignalEmit).toHaveBeenCalledWith("enable_video", { enabled: true });
    });

    it("doSetDisplayName", async () => {
        const store = createStore({
            withSignalConnection: true,
            connectToRoom: true,
        });

        await store.dispatch(doSetDisplayName({ displayName: "display name" }));

        expect(mockSignalEmit).toHaveBeenCalledWith("send_client_metadata", {
            type: "UserData",
            payload: { displayName: "display name" },
        });
    });
});

describe("reactors", () => {
    const connectedStore = (localMedia: Partial<typeof initialLocalMediaState> = {}) =>
        createStore({
            withSignalConnection: true,
            connectToRoom: true,
            initialState: {
                localMedia: { ...initialLocalMediaState, ...localMedia },
            },
        });

    describe("toggleCameraEnabled", () => {
        it("turns the camera off when explicitly disabled while on", async () => {
            const store = connectedStore({ cameraEnabled: true });

            store.dispatch(toggleCameraEnabled({ enabled: false }));
            await flushMicrotasks();

            expect(mockSignalEmit).toHaveBeenCalledWith("enable_video", { enabled: false });
            expect(store.getState().localParticipant.isVideoEnabled).toBe(false);
        });

        it("stays off when explicitly disabled while already off", async () => {
            const store = connectedStore({ cameraEnabled: false });

            store.dispatch(toggleCameraEnabled({ enabled: false }));
            await flushMicrotasks();

            expect(mockSignalEmit).not.toHaveBeenCalledWith("enable_video", { enabled: true });
            expect(store.getState().localParticipant.isVideoEnabled).toBe(false);
        });

        it("flips the current state when called without a value", async () => {
            const store = connectedStore({ cameraEnabled: true });

            store.dispatch(toggleCameraEnabled({}));
            await flushMicrotasks();

            expect(mockSignalEmit).toHaveBeenCalledWith("enable_video", { enabled: false });
            expect(store.getState().localParticipant.isVideoEnabled).toBe(false);
        });
    });

    describe("toggleMicrophoneEnabled", () => {
        it("turns the microphone off when explicitly disabled while on", async () => {
            const store = connectedStore({ microphoneEnabled: true });

            store.dispatch(toggleMicrophoneEnabled({ enabled: false }));
            await flushMicrotasks();

            expect(mockSignalEmit).toHaveBeenCalledWith("enable_audio", { enabled: false });
            expect(store.getState().localParticipant.isAudioEnabled).toBe(false);
        });

        it("stays off when explicitly disabled while already off", async () => {
            const store = connectedStore({ microphoneEnabled: false });

            store.dispatch(toggleMicrophoneEnabled({ enabled: false }));
            await flushMicrotasks();

            expect(mockSignalEmit).not.toHaveBeenCalledWith("enable_audio", { enabled: true });
            expect(store.getState().localParticipant.isAudioEnabled).toBe(false);
        });

        it("flips the current state when called without a value", async () => {
            const store = connectedStore({ microphoneEnabled: true });

            store.dispatch(toggleMicrophoneEnabled({}));
            await flushMicrotasks();

            expect(mockSignalEmit).toHaveBeenCalledWith("enable_audio", { enabled: false });
            expect(store.getState().localParticipant.isAudioEnabled).toBe(false);
        });
    });

    describe("roomJoined", () => {
        it("adopts the mute state we joined with", () => {
            const store = createStore();
            const selfClient = randomSignalClient({ isAudioEnabled: false, isVideoEnabled: false });

            store.dispatch(
                signalEvents.roomJoined({
                    selfId: selfClient.id,
                    clientClaim: "client-claim",
                    eventClaim: "",
                    room: {
                        mode: "group",
                        clients: [selfClient],
                        knockers: [],
                        spotlights: [],
                        session: null,
                        isClaimed: true,
                        isLocked: false,
                        iceServers: { iceServers: [] },
                        mediaserverConfigTtlSeconds: 0,
                        name: "",
                        organizationId: "",
                        turnServers: [],
                    },
                }),
            );

            const { isAudioEnabled, isVideoEnabled } = store.getState().localParticipant;

            expect(isAudioEnabled).toBe(false);
            expect(isVideoEnabled).toBe(false);
        });
    });
});
