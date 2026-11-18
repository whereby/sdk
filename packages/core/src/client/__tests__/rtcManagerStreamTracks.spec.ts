import { P2pRtcManager, VegaRtcManager } from "@whereby.com/media";
import MockMediaStream from "../../__mocks__/MediaStream";
import { randomRemoteParticipant } from "../../__mocks__/appMocks";
import { createWebRtcEmitter } from "../../redux/slices/rtcConnection";
import { createStore, mockRtcManager } from "../../redux/tests/store.setup";
import { RootState, Store, signalEvents } from "../../redux";
import { RoomConnectionClient } from "../RoomConnection";

// Drives the real Vega and P2P RTC managers through the ways a remote stream gains and loses tracks, wired to
// the store as they are in a room, to pin down when room connection subscribers see a stream's tracks. Apps
// like the assistant SDK and the recorders read the tracks from the participants' streams when notified.
describe("remote stream tracks", () => {
    const remoteClientId = "remote-client";

    let store: Store;
    let roomConnection: RoomConnectionClient;
    let originalMediaStream: typeof MediaStream;

    const room = {
        iceServers: { iceServers: [] },
        sfuServer: { url: "wss://sfu.example.com" },
        name: "/room",
        organizationId: "1",
        isClaimed: true,
        clients: [],
        isLocked: false,
        knockers: [],
        mediaserverConfigTtlSeconds: 3600,
        mode: "group",
        spotlights: [],
        session: null,
        turnServers: [],
    };

    const createRtcManagerOptions = () => ({
        selfId: "self",
        room,
        emitter: createWebRtcEmitter(store.dispatch),
        serverSocket: { on: jest.fn(() => jest.fn()), once: jest.fn(), emit: jest.fn(), getManager: jest.fn() },
        webrtcProvider: { getMediaOptions: () => ({}) },
        features: {},
        eventClaim: "/claim",
    });

    // The store can't hold the real RTC manager, as it changes its own fields, which the store's checks for state
    // mutations in tests report. It holds the mock manager instead, which passes on what this test checks.
    const setUpStore = (getRtcManager: () => { setRemoteScreenshareVideoTrackIds: (trackIds: string[]) => void }) => {
        const rtcManager = {
            ...mockRtcManager,
            setRemoteScreenshareVideoTrackIds: (trackIds: string[]) =>
                getRtcManager().setRemoteScreenshareVideoTrackIds(trackIds),
        };
        store = createStore({
            withRtcManager: true,
            initialState: {
                rtcConnection: { rtcManager } as unknown as RootState["rtcConnection"],
                remoteParticipants: { remoteParticipants: [randomRemoteParticipant({ id: remoteClientId })] },
            },
        });
        roomConnection = new RoomConnectionClient(store);
    };

    // The kinds of the tracks of the remote participant's camera stream, each time subscribers are notified
    const subscribeToCameraTracks = () => {
        const notifications: string[][] = [];
        roomConnection.subscribeToRemoteParticipants((participants) => {
            const participant = participants.find(({ id }) => id === remoteClientId);
            notifications.push(participant?.stream?.getTracks().map(({ kind }) => kind) ?? []);
        });
        return notifications;
    };

    const cameraTracks = () =>
        roomConnection
            .getState()
            .remoteParticipants.find(({ id }) => id === remoteClientId)
            ?.stream?.getTracks()
            .map(({ kind }) => kind);

    const track = (kind: string, id = `${kind}-track`) => ({ id, kind }) as MediaStreamTrack;

    const sendChatMessage = () =>
        store.dispatch(
            signalEvents.chatMessage({
                id: "message",
                messageType: "text",
                roomName: "/room",
                senderId: remoteClientId,
                text: "Hello",
                timestamp: new Date(0).toISOString(),
                userId: "user",
            }),
        );

    beforeEach(() => {
        originalMediaStream = global.MediaStream;
        global.MediaStream = MockMediaStream;
    });

    afterEach(() => {
        roomConnection.destroy();
        global.MediaStream = originalMediaStream;
    });

    describe("in a Vega (SFU) room", () => {
        let rtcManager: VegaRtcManager;

        // A mediasoup receive transport whose consumers close as mediasoup's do
        const createReceiveTransport = () => ({
            consume: jest.fn(async (options: { id: string; kind: string; appData: unknown }) => {
                const closeListeners: (() => void)[] = [];
                return {
                    id: options.id,
                    kind: options.kind,
                    track: track(options.kind, `${options.id}-track`),
                    appData: options.appData,
                    _appData: {},
                    _rtpParameters: { encodings: [] },
                    pause: jest.fn(),
                    resume: jest.fn(),
                    close: () => closeListeners.forEach((listener) => listener()),
                    observer: { once: (_: string, listener: () => void) => closeListeners.push(listener) },
                };
            }),
        });

        const consumerReady = (id: string, kind: string, { screenShare = false } = {}) =>
            rtcManager._onMessage({
                method: "consumerReady",
                data: {
                    id,
                    producerId: `${id}-producer`,
                    kind,
                    rtpParameters: {},
                    appData: {
                        sourceClientId: remoteClientId,
                        streamId: screenShare ? "screenshare-stream" : remoteClientId,
                        screenShare,
                    },
                },
            });

        const consumerClosed = (consumerId: string) =>
            rtcManager._onMessage({ method: "consumerClosed", data: { consumerId, reason: "producerClosed" } });

        beforeEach(() => {
            setUpStore(() => rtcManager);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rtcManager = new VegaRtcManager(createRtcManagerOptions() as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const internals = rtcManager as any;
            internals._mediasoupDeviceInitializedAsync?.catch?.(() => {});
            internals._vegaConnection = { message: jest.fn() };
            internals._receiveTransport = createReceiveTransport();
            rtcManager.acceptNewStream({ clientId: remoteClientId, streamId: remoteClientId });
        });

        it.each([
            ["audio", "video"],
            ["video", "audio"],
        ])("notifies subscribers with each track as it's added, %s first", async (firstKind, secondKind) => {
            const notifications = subscribeToCameraTracks();

            await consumerReady("first", firstKind);
            expect(notifications.at(-1)).toEqual([firstKind]);

            const notificationCount = notifications.length;
            await consumerReady("second", secondKind);
            expect(notifications.length).toBeGreaterThan(notificationCount);
            expect(notifications.at(-1)).toEqual([firstKind, secondKind]);
        });

        // Vega doesn't announce a removed track while the stream has other tracks, so nothing changes in the store
        it("doesn't notify subscribers when one of the stream's tracks is removed", async () => {
            await consumerReady("audio", "audio");
            await consumerReady("video", "video");
            const notifications = subscribeToCameraTracks();

            await consumerClosed("video");

            expect(notifications).toEqual([]);
            expect(cameraTracks()).toEqual(["audio"]);
        });

        it.each([
            ["audio", "video"],
            ["video", "audio"],
        ])(
            "notifies screenshare subscribers with each track as it's added, %s first",
            async (firstKind, secondKind) => {
                rtcManager.acceptNewStream({ clientId: remoteClientId, streamId: "screenshare-stream" });
                const notifications: string[][] = [];
                roomConnection.subscribeToScreenshares((screenshares) => {
                    notifications.push(screenshares[0]?.stream?.getTracks().map(({ kind }) => kind) ?? []);
                });

                await consumerReady("first", firstKind, { screenShare: true });
                expect(notifications.at(-1)).toEqual([firstKind]);

                const notificationCount = notifications.length;
                await consumerReady("second", secondKind, { screenShare: true });
                expect(notifications.length).toBeGreaterThan(notificationCount);
                expect(notifications.at(-1)).toEqual([firstKind, secondKind]);
            },
        );
    });

    describe("in a P2P room", () => {
        let rtcManager: P2pRtcManager;
        let originalRTCPeerConnection: typeof RTCPeerConnection;

        const acceptStream = (streamId: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { pc } = (rtcManager as any).acceptNewStream({ clientId: remoteClientId, streamId });
            return pc as RTCPeerConnection;
        };

        // As in a browser, the stream has all the tracks negotiated with it before their track events fire
        const receiveStream = (pc: RTCPeerConnection, id: string, tracks: MediaStreamTrack[]) => {
            const stream = new MockMediaStream();
            stream.id = id;
            tracks.forEach((track) => stream.addTrack(track));
            tracks.forEach((track) => pc.ontrack?.({ track, streams: [stream] } as unknown as RTCTrackEvent));
            return stream;
        };

        beforeEach(() => {
            originalRTCPeerConnection = window.RTCPeerConnection;
            window.RTCPeerConnection = jest.fn(() => ({
                addIceCandidate: jest.fn(),
                createOffer: jest.fn(async () => ({})),
                createAnswer: jest.fn(async () => ({})),
                addTrack: jest.fn(),
                setRemoteDescription: jest.fn(async () => {}),
                setLocalDescription: jest.fn(async () => {}),
                signalingState: "stable",
                addEventListener: jest.fn(),
                close: jest.fn(),
                getReceivers: jest.fn(() => []),
                getSenders: jest.fn(() => []),
                getStats: jest.fn(async () => new Map()),
                getTransceivers: jest.fn(() => []),
            })) as unknown as typeof RTCPeerConnection;
            setUpStore(() => rtcManager);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rtcManager = new P2pRtcManager(createRtcManagerOptions() as any);
        });

        afterEach(() => {
            window.RTCPeerConnection = originalRTCPeerConnection;
        });

        it("notifies subscribers once with all the tracks negotiated with the stream", () => {
            const pc = acceptStream("0");
            const notifications = subscribeToCameraTracks();

            receiveStream(pc, "camera-stream", [track("audio"), track("video")]);

            expect(notifications).toEqual([["audio", "video"]]);
        });

        // P2P only announces new streams, so nothing changes in the store
        it("doesn't notify subscribers when a track is removed from the stream", () => {
            const pc = acceptStream("0");
            const videoTrack = track("video");
            const stream = receiveStream(pc, "camera-stream", [track("audio"), videoTrack]);
            const notifications = subscribeToCameraTracks();

            stream.removeTrack(videoTrack);

            expect(notifications).toEqual([]);
            expect(cameraTracks()).toEqual(["audio"]);
        });

        // P2P only announces new streams, so a track added to an announced one later, like the video track of a
        // remote participant turning their camera on without a stopped video track to replace, is only seen when
        // subscribers are next notified, like when someone sends a chat message
        it("notifies subscribers of a track added to a stream later, when the room next changes", () => {
            const pc = acceptStream("0");
            const stream = receiveStream(pc, "camera-stream", [track("audio")]);
            const notifications = subscribeToCameraTracks();

            const videoTrack = track("video");
            stream.addTrack(videoTrack);
            pc.ontrack?.({ track: videoTrack, streams: [stream] } as unknown as RTCTrackEvent);
            sendChatMessage();

            expect(notifications.at(-1)).toEqual(["audio", "video"]);
        });

        it("tells the RTC manager about a screenshare's video track", () => {
            const setRemoteScreenshareVideoTrackIds = jest.spyOn(rtcManager, "setRemoteScreenshareVideoTrackIds");
            const pc = acceptStream("0");
            receiveStream(pc, "camera-stream", [track("audio"), track("video")]);

            receiveStream(pc, "screenshare-stream", [track("video", "screenshare-video-track")]);

            expect(setRemoteScreenshareVideoTrackIds).toHaveBeenLastCalledWith(["screenshare-video-track"]);
        });
    });
});
