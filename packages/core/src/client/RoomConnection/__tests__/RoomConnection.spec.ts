import { ChatMessage, RtcStreamAddedPayload } from "@whereby.com/media";
import { RoomConnectionClient } from "..";
import { doHandleStreamingStarted, rtcEvents, setDisplayName, signalEvents } from "../../../redux";
import { createStore } from "../../../redux/tests/store.setup";
import { randomChatMessage, randomMediaStream, randomSignalClient, randomString } from "../../../__mocks__/appMocks";

describe("RoomConnection", () => {
    let roomConnectionClient: RoomConnectionClient;
    let store: ReturnType<typeof createStore>;

    beforeEach(() => {
        store = createStore({ connectToRoom: true, withRtcManager: true });
        jest.spyOn(store, "dispatch");
        roomConnectionClient = new RoomConnectionClient(store);
    });

    describe("state subscriptions", () => {
        describe("subscribeToChatMessages", () => {
            it("triggers when chat messages are updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToChatMessages(callback);

                const client = randomSignalClient();
                const chatMessage: ChatMessage = randomChatMessage({ senderId: client.id });
                store.dispatch(signalEvents.newClient({ client }));
                store.dispatch(signalEvents.chatMessage(chatMessage));

                expect(callback).toHaveBeenCalledWith([
                    { text: chatMessage.text, senderId: chatMessage.senderId, timestamp: chatMessage.timestamp },
                ]);
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToChatMessages(callback);
                unsubscribe();

                const client = randomSignalClient();
                const chatMessage: ChatMessage = randomChatMessage({ senderId: client.id });
                store.dispatch(signalEvents.newClient({ client }));
                store.dispatch(signalEvents.chatMessage(chatMessage));

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToCloudRecording", () => {
            it("triggers when cloud recording state is updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToCloudRecording(callback);

                const client = randomSignalClient({ role: { roleName: "recorder" } });
                store.dispatch(signalEvents.newClient({ client }));

                expect(callback).toHaveBeenCalledWith({ status: "recording" });
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToCloudRecording(callback);
                unsubscribe();

                const client = randomSignalClient({ role: { roleName: "recorder" } });
                store.dispatch(signalEvents.newClient({ client }));

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToConnectionStatus", () => {
            it("triggers when connection status is updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToConnectionStatus(callback);

                store.dispatch(signalEvents.disconnect());

                expect(callback).toHaveBeenCalledWith("disconnected");
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToConnectionStatus(callback);
                unsubscribe();

                store.dispatch(signalEvents.disconnect());

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToLiveStream", () => {
            it("triggers when live stream state is updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToLiveStream(callback);

                store.dispatch(doHandleStreamingStarted());

                expect(callback).toHaveBeenCalledWith(expect.objectContaining({ status: "streaming" }));
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToLiveStream(callback);
                unsubscribe();

                store.dispatch(doHandleStreamingStarted());

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToLocalParticipant", () => {
            it("triggers when local participant is updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToLocalParticipant(callback);

                store.dispatch(setDisplayName({ displayName: "NewDisplayName" }));

                expect(callback).toHaveBeenCalledWith(expect.objectContaining({ displayName: "NewDisplayName" }));
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToLocalParticipant(callback);
                unsubscribe();

                store.dispatch(setDisplayName({ displayName: "NewDisplayName" }));

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToRemoteParticipants", () => {
            it("triggers when remote participants are updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToRemoteParticipants(callback);

                const client = randomSignalClient();
                store.dispatch(signalEvents.newClient({ client }));

                expect(callback).toHaveBeenCalledWith(
                    expect.arrayContaining([expect.objectContaining({ id: client.id })]),
                );
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToRemoteParticipants(callback);
                unsubscribe();

                const client = randomSignalClient();
                store.dispatch(signalEvents.newClient({ client }));

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToScreenshares", () => {
            it("triggers when screenshares are updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToScreenshares(callback);

                const client = randomSignalClient();
                store.dispatch(signalEvents.newClient({ client }));
                const screenshareEvent: RtcStreamAddedPayload = {
                    clientId: client.id,
                    stream: randomMediaStream(),
                    streamId: randomString(),
                    streamType: "screenshare",
                };
                store.dispatch(rtcEvents.streamAdded(screenshareEvent));

                expect(callback).toHaveBeenCalledWith(
                    expect.arrayContaining([expect.objectContaining({ id: `pres-${client.id}` })]),
                );
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToScreenshares(callback);
                unsubscribe();

                const client = randomSignalClient();
                store.dispatch(signalEvents.newClient({ client }));
                const screenshareEvent: RtcStreamAddedPayload = {
                    clientId: client.id,
                    stream: randomMediaStream(),
                    streamId: randomString(),
                    streamType: "screenshare",
                };
                store.dispatch(rtcEvents.streamAdded(screenshareEvent));

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToWaitingParticipants", () => {
            it("triggers when waiting participants are updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToWaitingParticipants(callback);

                const clientId = randomString();
                const displayName = randomString();
                store.dispatch(
                    signalEvents.roomKnocked({ clientId, displayName, imageUrl: randomString(), liveVideo: true }),
                );

                expect(callback).toHaveBeenCalledWith([{ id: clientId, displayName }]);
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToWaitingParticipants(callback);
                unsubscribe();

                store.dispatch(
                    signalEvents.roomKnocked({
                        clientId: randomString(),
                        displayName: randomString(),
                        imageUrl: randomString(),
                        liveVideo: true,
                    }),
                );

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToBreakoutConfig", () => {
            it("triggers when breakout config is updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToBreakoutConfig(callback);

                store.dispatch(
                    signalEvents.breakoutSessionUpdated({
                        groups: { "group-1": "Group 1" },
                        startedAt: new Date(),
                    }),
                );

                expect(callback).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToBreakoutConfig(callback);
                unsubscribe();

                store.dispatch(
                    signalEvents.breakoutSessionUpdated({
                        groups: { "group-1": "Group 1" },
                        startedAt: new Date(),
                    }),
                );

                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("subscribeToSpotlightedParticipants", () => {
            it("triggers when spotlighted participants are updated", () => {
                const callback = jest.fn();
                roomConnectionClient.subscribeToSpotlightedParticipants(callback);

                const client = randomSignalClient();
                store.dispatch(signalEvents.newClient({ client }));
                store.dispatch(
                    signalEvents.spotlightAdded({ clientId: client.id, streamId: "0", requestedByClientId: client.id }),
                );

                expect(callback).toHaveBeenCalledWith(
                    expect.arrayContaining([expect.objectContaining({ clientId: client.id })]),
                );
            });

            it("stops triggering after unsubscribe", () => {
                const callback = jest.fn();
                const unsubscribe = roomConnectionClient.subscribeToSpotlightedParticipants(callback);
                unsubscribe();

                const client = randomSignalClient();
                store.dispatch(signalEvents.newClient({ client }));
                store.dispatch(
                    signalEvents.spotlightAdded({
                        clientId: client.id,
                        streamId: "0",
                        requestedByClientId: randomString(),
                    }),
                );

                expect(callback).not.toHaveBeenCalled();
            });
        });
    });
});
