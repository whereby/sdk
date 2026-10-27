import { RoomConnectionClient } from "../";
import { AUDIO_ONLY_MODE_CHANGED, ROOM_REJOINED, REMOTE_PARTICIPANT_QUALITY_REPORT_CHANGED } from "../events";
import { doAppStart, roomRejoined, Store, RootState } from "../../../redux";
import { createStore, mockServices } from "../../../redux/tests/store.setup";

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
        it("triggers the chat messages listener", () => {
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

    describe("room:rejoined", () => {
        it("is emitted when the room is rejoined", () => {
            const callback = jest.fn();
            client.on(ROOM_REJOINED, callback);

            mockStore.dispatch(roomRejoined({ selfId: "second-id", previousSelfId: "first-id" }));

            expect(callback).toHaveBeenCalledWith({
                selfId: "second-id",
                previousSelfId: "first-id",
                selfIdChanged: true,
            });
        });
    });

    describe("subscribeToAudioOnlyMode", () => {
        it("triggers the audio-only mode listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToAudioOnlyMode(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                rtcConnection: { ...initialState.rtcConnection, isAudioOnlyModeEnabled: true },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(true);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                rtcConnection: { ...initialState.rtcConnection, isAudioOnlyModeEnabled: false },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it("emits the audio-only mode changed event", () => {
            const listener = jest.fn();
            client.on(AUDIO_ONLY_MODE_CHANGED, listener);

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                rtcConnection: { ...initialState.rtcConnection, isAudioOnlyModeEnabled: true },
            });
            storeSubscriber();

            expect(listener).toHaveBeenCalledWith(true);
        });
    });

    describe("subscribeToRemoteParticipantQualityReport", () => {
        const remoteQualityScores = {
            "client-1": { total: "warning", video: "warning", audio: "ok" },
        } as const;
        const report = { "client-1": { quality: "warning" } };

        const withRemoteQualityScores = (scores?: typeof remoteQualityScores): RootState => ({
            ...initialState,
            connectionMonitor: { ...initialState.connectionMonitor, remoteQualityScores: scores },
        });

        it("triggers the call quality report listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToRemoteParticipantQualityReport(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue(withRemoteQualityScores(remoteQualityScores));
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(report);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue(withRemoteQualityScores(undefined));
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it("emits the call quality report changed event", () => {
            const listener = jest.fn();
            client.on(REMOTE_PARTICIPANT_QUALITY_REPORT_CHANGED, listener);

            (mockStore.getState as jest.Mock).mockReturnValue(withRemoteQualityScores(remoteQualityScores));
            storeSubscriber();

            expect(listener).toHaveBeenCalledWith(report);
        });

        it("reports an empty report while there are no scores", () => {
            expect(client.getState().remoteParticipantQualityReport).toEqual({});
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
                localScreenshare: { ...initialState.localScreenshare, status: "starting" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith("starting");

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localScreenshare: { ...initialState.localScreenshare, status: "active" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith("active");

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localScreenshare: { ...initialState.localScreenshare, status: "inactive" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith(undefined);

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localScreenshare: { ...initialState.localScreenshare, status: "active" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledTimes(3);
        });
    });

    describe("subscribeToLocalScreenshare", () => {
        it("triggers the local screenshare listener", () => {
            const callback = jest.fn();
            const unsubscribe = client.subscribeToLocalScreenshare(callback);

            storeSubscriber();
            expect(callback).not.toHaveBeenCalled();

            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localScreenshare: { status: "starting" },
            });
            storeSubscriber();
            expect(callback).toHaveBeenCalledWith({ status: "requested" });

            unsubscribe();
            (mockStore.getState as jest.Mock).mockReturnValue({
                ...initialState,
                localScreenshare: { status: "active" },
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
            expect(callback).toHaveBeenCalledWith({ id: "1", displayName: "Me", isScreenSharing: false });

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
            expect(callback).toHaveBeenCalledWith([{ id: "1", breakoutGroupAssigned: "" }]);

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

    describe("joinRoom", () => {
        it("carries the options from initialize into the app config", () => {
            (mockStore.dispatch as jest.Mock).mockImplementation(() => jest.fn());

            client.initialize({
                roomUrl: "https://example.whereby.com/test",
                displayName: "Test",
                localMediaOptions: { audio: true, video: true },
                initialMuteStates: { camera: true, microphone: true },
            });

            client.joinRoom();

            expect(mockStore.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: doAppStart.type,
                    payload: expect.objectContaining({
                        roomUrl: "https://example.whereby.com/test",
                        displayName: "Test",
                        localMediaOptions: { audio: true, video: true },
                        initialMuteStates: { camera: true, microphone: true },
                    }),
                }),
            );
        });

        it("rejects when the organization can't be fetched", async () => {
            console.error = jest.fn();
            mockServices.credentialsService.getCredentials.mockResolvedValue({ credentials: { uuid: "deviceId" } });
            mockServices.fetchOrganizationFromRoomUrl.mockRejectedValueOnce(new Error("Network error"));

            client.initialize({ roomUrl: "https://example.whereby.com/test" });

            await expect(client.joinRoom()).rejects.toEqual("organization_fetch_failed");
            expect(mockStore.getState().roomConnection).toEqual(
                expect.objectContaining({
                    status: "disconnected",
                    error: "organization_fetch_failed",
                }),
            );
        });

        it("rejects when the device credentials can't be fetched", async () => {
            console.error = jest.fn();
            mockServices.credentialsService.getCredentials.mockRejectedValue(new Error("Network error"));
            // The organization request waits on the credentials, so it fails with them.
            mockServices.fetchOrganizationFromRoomUrl.mockImplementation(async () => {
                await mockServices.credentialsService.getCredentials();
            });

            client.initialize({ roomUrl: "https://example.whereby.com/test" });

            await expect(client.joinRoom()).rejects.toEqual("device_credentials_fetch_failed");
            expect(mockStore.getState().roomConnection).toEqual(
                expect.objectContaining({
                    status: "disconnected",
                    error: "device_credentials_fetch_failed",
                }),
            );
        });
    });
});
