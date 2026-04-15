import { RoomConnectionClient } from "../";
import { Store, RootState } from "../../../redux";
import { createStore } from "../../../redux/tests/store.setup";

describe("RoomConnectionClient", () => {
    let client: RoomConnectionClient;
    let mockStore: Store;
    let initialState: RootState;
    let storeSubscriber: () => void;

    beforeEach(() => {
        mockStore = createStore();
        jest.spyOn(mockStore, "subscribe");
        jest.spyOn(mockStore, "dispatch");
        jest.spyOn(mockStore, "getState");
        initialState = mockStore.getState();
        client = new RoomConnectionClient(mockStore);
        // the function the client uses to listen for store changes
        storeSubscriber = (mockStore.subscribe as jest.Mock).mock.calls[0][0];
    });

    describe("subscribeToChatMessages", () => {
        it("triggers the chat messages lisneter", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToChatMessages(callback);

            // not called for no changes
            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            let chatState = { chatMessages: [{ text: "Some message" }] };
            (mockStore.getState as jest.Mock).mockReturnValue({ ...initialState, chat: chatState });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(chatState.chatMessages);

            unsubscribe();

            chatState = { chatMessages: [{ text: "another message" }] };
            (mockStore.getState as jest.Mock).mockReturnValue({ ...initialState, chat: chatState });
            // not called after unsubscribe
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToCloudRecording", () => {
        it("triggers the cloud recording listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToCloudRecording(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                cloudRecording: { status: "recording" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith({ status: "recording" });

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                cloudRecording: { status: "stopped" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToLiveTranscription", () => {
        it("triggers the live transcription listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToLiveTranscription(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                liveTranscription: { status: "requested" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith({ status: "requested" });

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                liveTranscription: { status: "transcribing" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToBreakoutConfig", () => {
        it("triggers the breakout config listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToBreakoutConfig(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockImplementation(() => ({
                ...initialState,
                breakout: { startedAt: new Date() },
            }));
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({ ...initialState, breakout: { isActive: false } });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToConnectionStatus", () => {
        it("triggers the connection status listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToConnectionStatus(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                roomConnection: { status: "connected" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith("connected");

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                roomConnection: { connectionStatus: "disconnected" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToConnectionError", () => {
        it("triggers the connection error listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToConnectionError(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            const roomConnection = { error: new Error() };
            (mockStore.getState as jest.Mock).mockReturnValue({ ...initialState, roomConnection });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(roomConnection.error);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                roomConnection: { connectionError: "other" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToLiveStream", () => {
        it("triggers the live stream listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToLiveStream(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            const startedAt = new Date();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                streaming: { isStreaming: true, startedAt },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith({ status: "streaming", startedAt: startedAt });

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                streaming: { liveStream: undefined },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToLocalScreenshareStatus", () => {
        it("triggers the local screenshare status listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToLocalScreenshareStatus(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localParticipant: { isScreenSharing: true },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith("active");

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localParticipant: { isScreenSharing: false },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToLocalParticipant", () => {
        it("triggers the local participant listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToLocalParticipant(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localParticipant: { id: "1", displayName: "Me" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith({ id: "1", displayName: "Me" });

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localParticipant: { id: "1", displayName: "Updated" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToRemoteParticipants", () => {
        it("triggers the remote participants listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToRemoteParticipants(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                remoteParticipants: { remoteParticipants: [{ id: "1" }] },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith([{ id: "1" }]);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                remoteParticipants: { remoteParticipants: [{ id: "2" }] },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToScreenshares", () => {
        it("triggers the screenshares listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToScreenshares(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                remoteParticipants: {
                    remoteParticipants: [{ presentationStream: { id: "id", getTracks: () => [] }, id: "pid" }],
                },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith([expect.objectContaining({ id: "id", participantId: "pid" })]);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                remoteParticipants: { remoteParticipants: [] },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToWaitingParticipants", () => {
        it("triggers the waiting participants listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToWaitingParticipants(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                waitingParticipants: { waitingParticipants: [{ id: "1" }] },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith([{ id: "1" }]);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                waitingParticipants: { waitingParticipants: [] },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToSpotlightedParticipants", () => {
        it("triggers the spotlighted participants listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToSpotlightedParticipants(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                spotlights: { sorted: [{ clientId: "1", streamId: "0" }] },
                remoteParticipants: { remoteParticipants: [{ id: "1" }] },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith([expect.objectContaining({ id: "1", clientId: "1" })]);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({ ...initialState, spotlights: { sorted: [] } });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToCameraState", () => {
        it("triggers the camera state listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToCameraState(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({ ...initialState, localMedia: { cameraEnabled: true } });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(true);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localMedia: { cameraEnabled: false },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToMicrophoneState", () => {
        it("triggers the microphone state listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToMicrophoneState(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localMedia: { microphoneEnabled: true },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(true);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localMedia: { microphoneEnabled: false },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("subscribeToRoomSessionId", () => {
        it("triggers the room session ID listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToRoomSessionId(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                roomConnection: { session: { id: "some ID" } },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith("some ID");

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                roomConnection: { session: { id: "some other ID" } },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });
});
