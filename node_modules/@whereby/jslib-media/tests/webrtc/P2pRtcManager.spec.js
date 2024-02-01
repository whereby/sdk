import * as baseRtcManagerSpec from "./baseRtcManagerSpec";

jest.mock("webrtc-adapter", () => {
    return {
        browserDetails: { browser: "chrome" },
    };
});

import * as helpers from "./webRtcHelpers";
import { itShouldThrowIfMissing } from "../helpers";
import * as CONNECTION_STATUS from "../../src/model/connectionStatusConstants";
import P2pRtcManager from "../../src/webrtc/P2pRtcManager";
import { RELAY_MESSAGES, PROTOCOL_RESPONSES } from "../../src/model/protocol";

const originalNavigator = global.navigator;

describe("P2pRtcManager", () => {
    let navigator;
    let serverSocketStub;
    let serverSocket;
    let emitter;
    let webrtcProvider;
    let clientId;
    let mediaContstraints;

    beforeEach(() => {
        window.RTCPeerConnection = helpers.createRTCPeerConnectionStub();
        mediaContstraints = {
            audio: true,
            video: true,
        };
        serverSocketStub = helpers.createServerSocketStub();
        serverSocket = serverSocketStub.socket;
        webrtcProvider = {
            webRtcDetectedBrowser: "chrome",
            webRtcDetectedBrowserVersion: "60",
            getMediaConstraints: () => mediaContstraints,
        };
        emitter = helpers.createEmitterStub();
        clientId = helpers.randomString("client-");

        navigator = {
            mediaDevices: {
                getUserMedia: () => {
                    throw "must be stubbed";
                },
            },
        };

        Object.defineProperty(global, "navigator", {
            value: navigator,
        });
    });

    afterEach(() => {
        Object.defineProperty(global, "navigator", {
            value: originalNavigator,
        });
    });

    function createRtcManager({
        selfId = helpers.randomString("client-"),
        roomName = helpers.randomString("/room-"),
        emitter: _emitter = emitter,
        serverSocket: _serverSocket = serverSocket,
        iceServers = [],
        features = {},
        roomData = {},
    } = {}) {
        return new P2pRtcManager({
            selfId,
            room: Object.assign({ name: roomName, iceServers: { iceServers } }, roomData),
            emitter: _emitter,
            serverSocket: _serverSocket,
            webrtcProvider,
            features,
            logger: {
                debug: () => {},
                error: () => {},
                info: () => {},
                log: () => {},
                warn: () => {},
            },
        });
    }

    afterEach(() => {
        delete window.RTCPeerConnection;
    });

    baseRtcManagerSpec.test(createRtcManager);

    describe("constructor", () => {
        const selfId = helpers.randomString("client-");
        const room = { name: helpers.randomString("/room-"), iceServers: {} };
        const features = {};

        itShouldThrowIfMissing("selfId", () => {
            //eslint-disable-next-line no-new
            new P2pRtcManager({
                room,
                emitter,
                serverSocket,
                webrtcProvider,
                features,
            });
        });

        itShouldThrowIfMissing("room", () => {
            //eslint-disable-next-line no-new
            new P2pRtcManager({
                selfId,
                emitter,
                serverSocket,
                webrtcProvider,
                features,
            });
        });

        itShouldThrowIfMissing("emitter", () => {
            //eslint-disable-next-line no-new
            new P2pRtcManager({
                selfId,
                room,
                serverSocket,
                webrtcProvider,
                features,
            });
        });

        itShouldThrowIfMissing("serverSocket", () => {
            //eslint-disable-next-line no-new
            new P2pRtcManager({
                selfId,
                room,
                emitter,
                webrtcProvider,
                features,
            });
        });

        itShouldThrowIfMissing("webrtcProvider", () => {
            //eslint-disable-next-line no-new
            new P2pRtcManager({
                selfId,
                room,
                emitter,
                serverSocket,
                features,
            });
        });
    });

    describe("isInitializedWith", () => {
        const selfId = helpers.randomString("client-");
        const roomName = helpers.randomString("/room-");
        let rtcManager;

        beforeEach(() => {
            rtcManager = createRtcManager({ selfId, roomName });
        });

        it("should return true if all arguments provided during creation matches the provided arguments", () => {
            const actual = rtcManager.isInitializedWith({
                selfId,
                roomName,
                isSfu: false,
            });

            expect(actual).toEqual(true);
        });

        it("should return false if the provided selfId is different from the current one", () => {
            const actual = rtcManager.isInitializedWith({
                selfId: selfId + "-1212",
                roomName,
                isSfu: false,
            });

            expect(actual).toEqual(false);
        });

        it("should return false if the provided roomName is different from the current one", () => {
            const actual = rtcManager.isInitializedWith({
                selfId,
                roomName: roomName + "+somethingmore",
                isSfu: false,
            });

            expect(actual).toEqual(false);
        });

        it("should return false if isSfu is set", () => {
            const actual = rtcManager.isInitializedWith({
                selfId,
                roomName,
                isSfu: true,
            });

            expect(actual).toEqual(false);
        });
    });

    describe("_connect", () => {
        const iceServers = helpers.createIceServersConfig();

        it("creates a new peer connection", () => {
            createRtcManager({ iceServers })._connect(clientId);

            // The object should be constructed with the given peer connection config.
            expect(window.RTCPeerConnection).toHaveBeenCalledWith(
                {
                    iceServers,
                    sdpSemantics: "unified-plan",
                },
                expect.anything()
            );
        });

        it("uses latest ICE server information", () => {
            const updatedIceServers = helpers.createIceServersConfig();
            const rtcManager = createRtcManager({ iceServers });
            rtcManager.setupSocketListeners();
            serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, { iceServers: updatedIceServers });

            rtcManager._connect(clientId);

            expect(window.RTCPeerConnection).toHaveBeenCalledWith(
                {
                    iceServers: updatedIceServers,
                    sdpSemantics: "unified-plan",
                },
                expect.anything()
            );
        });

        it("defaults to creating a new peer connection with unified semantics", () => {
            createRtcManager({ iceServers })._connect(clientId, {});

            expect(window.RTCPeerConnection).toHaveBeenCalledWith(
                { sdpSemantics: "unified-plan", iceServers },
                expect.anything()
            );
        });

        it("creates a new peer connection with iceTransports set to relay if useOnlyTurn feature is set", () => {
            createRtcManager({ iceServers, features: { useOnlyTURN: true } })._connect(clientId, {});

            // The object should be constructed some TURN servers and iceTransportPolicy set to 'relay'.
            expect(window.RTCPeerConnection).toHaveBeenCalledWith(
                {
                    iceTransportPolicy: "relay",
                    sdpSemantics: "unified-plan",
                    iceServers,
                },
                expect.anything()
            );
        });

        it("stores the new peer connection", async () => {
            const rtcManager = createRtcManager();
            const { pc } = await rtcManager._connect(clientId);

            // The pc should be added to list of peer connections.
            expect(rtcManager.peerConnections[clientId].pc).toEqual(pc);
        });

        it("registers callbacks on the peer connection", async () => {
            const { pc } = await createRtcManager()._connect(clientId);

            // Callback functions should have been attached.
            expect(pc.onnegotiationneeded).toEqual(expect.any(Function));
            expect(pc.onicecandidate).toEqual(expect.any(Function));
            expect(pc.ontrack).toEqual(expect.any(Function));
            expect(pc.oniceconnectionstatechange).toEqual(expect.any(Function));
        });

        it("creates an offer", async () => {
            const { pc } = await createRtcManager()._connect(clientId);

            // An offer was created.
            expect(pc.createOffer).toHaveBeenCalled();
        });

        it("does not emit a response on the server socket", () => {
            createRtcManager()._connect(clientId);

            expect(serverSocket.emit).toHaveBeenCalledTimes(0);
        });
    });

    describe("accept", () => {
        it("registers a callback for oniceconnectionstatechange on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.oniceconnectionstatechange).toEqual(expect.any(Function));
        });

        it("registers a callback for onnegotiationneeded on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.onnegotiationneeded).toEqual(expect.any(Function));
        });

        it("registers a callback for onicecandidate on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.onicecandidate).toEqual(expect.any(Function));
        });

        it("registers a callback for ontrack on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.ontrack).toEqual(expect.any(Function));
        });
    });

    describe("peerConnection callback", () => {
        describe("onnegotiationneeded", () => {
            it("negotiates the peer connection after it is connected", async () => {
                const { pc } = await createRtcManager().accept({ clientId });
                pc.iceConnectionState = "connected";
                pc.oniceconnectionstatechange();

                pc.onnegotiationneeded();

                expect(pc.createOffer).toHaveBeenCalledWith(expect.anything());
            });

            it('does not negotiate peer connection when iceConnectionState is "new"', async () => {
                const { pc } = await createRtcManager().accept({ clientId });

                pc.iceConnectionState = "new";
                pc.onnegotiationneeded();

                expect(pc.createOffer).toHaveBeenCalledTimes(0);
            });

            it("does not re-negotiate peer connection during initial negotiation", async () => {
                const { pc } = await createRtcManager().accept({ clientId });

                // during initial negotiation, iceConnectionState changes from "new" before the
                // oniceconnectionstatechanged event is delivered
                pc.iceConnectionState = "checking";
                pc.onnegotiationneeded();

                expect(pc.createOffer).toHaveBeenCalledTimes(0);
            });
        });

        describe("onicecandidate", () => {
            it("sends the ICE_CANDIDATE on the socket with the candidate object", async () => {
                const { pc } = await createRtcManager()._connect(clientId);

                const candidatePackage = helpers.getValidCandidatePackage();
                pc.onicecandidate({ candidate: candidatePackage });

                expect(serverSocket.emit).toHaveBeenCalledWith(
                    RELAY_MESSAGES.ICE_CANDIDATE,
                    {
                        receiverId: clientId,
                        message: candidatePackage,
                    },
                    undefined
                );
            });

            // TODO: Is this test relevant? We do not filter candidates in this path..
            it("sends relay candidates if features.useOnlyTURN is enabled", async () => {
                const features = { useOnlyTURN: true };
                const { pc } = await createRtcManager({ features })._connect(clientId);

                const candidatePackage = helpers.getValidRelayCandidatePackage();
                pc.onicecandidate({ candidate: candidatePackage });

                expect(serverSocket.emit).toHaveBeenCalledWith(
                    RELAY_MESSAGES.ICE_CANDIDATE,
                    {
                        receiverId: clientId,
                        message: candidatePackage,
                    },
                    undefined
                );
            });
        });

        describe("oniceconnectionstatechange", () => {
            let rtcManager;

            beforeEach(() => {
                rtcManager = createRtcManager();
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            const iceStateToConnectionStatus = {
                checking: "CONNECTING",
                connected: "CONNECTION_SUCCESSFUL",
                completed: "CONNECTION_SUCCESSFUL",
                disconnected: "CONNECTION_DISCONNECTED",
            };

            describe("broadcasts when ice connection state becomes", () => {
                Object.keys(iceStateToConnectionStatus).forEach((iceState) => {
                    const expectedStatus = iceStateToConnectionStatus[iceState];

                    it("broadcasts when ice connection state becomes " + iceState, async () => {
                        const { pc } = await createRtcManager().accept({ clientId });

                        pc.iceConnectionState = iceState;
                        pc.localDescription = { type: "offer" };
                        pc.oniceconnectionstatechange();
                        jest.advanceTimersByTime(0);

                        expect(emitter.emit).toHaveBeenCalledWith(
                            CONNECTION_STATUS.EVENTS.CLIENT_CONNECTION_STATUS_CHANGED,
                            expect.objectContaining({
                                clientId,
                                streamIds: [],
                                status: CONNECTION_STATUS.TYPES[expectedStatus],
                            })
                        );
                    });
                });
            });

            it("should call rtcManager._maybeRestartIce with the client id if the client sent the offer on disconnect", async () => {
                jest.spyOn(rtcManager, "_maybeRestartIce");
                const { pc } = await rtcManager._connect(clientId);

                pc.iceConnectionState = "disconnected";
                pc.localDescription = { type: "offer" };
                pc.oniceconnectionstatechange();

                jest.advanceTimersByTime(5000);
                expect(rtcManager._maybeRestartIce).toHaveBeenCalledWith(clientId, expect.anything());
            });

            it("should call rtcManager.maybeRestartIce with the client id if the client sent the offer on failed", async () => {
                jest.spyOn(rtcManager, "_maybeRestartIce");
                const { pc } = await rtcManager._connect(clientId);

                pc.iceConnectionState = "disconnected";
                pc.localDescription = { type: "offer" };
                pc.oniceconnectionstatechange();

                jest.advanceTimersByTime(5000);
                expect(rtcManager._maybeRestartIce).toHaveBeenCalledWith(clientId, expect.anything());
            });
        });
    });

    describe("stopOrResumeVideo", () => {
        let localStream;
        let rtcManager;

        beforeEach(() => {
            jest.useFakeTimers();
            localStream = helpers.createMockedMediaStream();
            rtcManager = createRtcManager();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        describe("when disabling", () => {
            it("should stop the video track after 5 seconds", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).toHaveBeenCalledTimes(0);
                jest.advanceTimersByTime(5000);
                expect(videoTrack.stop).toHaveBeenCalledTimes(1);
            });

            it("should NOT stop track if it is still enabled", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = true;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).toHaveBeenCalledTimes(0);
                jest.advanceTimersByTime(5000);
                expect(videoTrack.stop).toHaveBeenCalledTimes(0);
            });

            it("should remove the track from local stream", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                jest.advanceTimersByTime(5000);

                expect(localStream.removeTrack).toHaveBeenCalledWith(videoTrack);
            });

            it("should emit event", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                jest.advanceTimersByTime(5000);

                expect(emitter.emit).toHaveBeenCalledWith(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_REMOVED, {
                    stream: localStream,
                    track: videoTrack,
                });
            });
        });

        describe("when enabling", () => {
            let gumStream;

            beforeEach(() => {
                gumStream = helpers.createMockedMediaStream();
                global.navigator.mediaDevices.getUserMedia = jest.fn(() => Promise.resolve(gumStream));
                localStream.removeTrack(localStream.getVideoTracks()[0]);
            });

            it("should obtain new video track with existing constraints", () => {
                mediaContstraints = { video: { some: "constraint" } };

                rtcManager.stopOrResumeVideo(localStream, true);

                expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
                    video: mediaContstraints.video,
                });
            });

            it("should add video track to local stream", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(localStream.addTrack).toHaveBeenCalledWith(expectedTrack);
            });

            it("should emit event", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(emitter.emit).toHaveBeenCalledWith(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                    streamId: localStream.id,
                    tracks: [expectedTrack],
                    screenShare: false,
                });
            });

            it("should add track to peer connection(s)", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                jest.spyOn(rtcManager, "_addTrackToPeerConnections");

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(rtcManager._addTrackToPeerConnections).toHaveBeenCalledWith(expectedTrack);
            });

            it("should replace track in peer connection(s) when stopped track exists", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                const stoppedTrack = helpers.createMockedMediaStreamTrack({ kind: "video" });
                rtcManager._stoppedVideoTrack = stoppedTrack;
                jest.spyOn(rtcManager, "_replaceTrackToPeerConnections");

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(rtcManager._replaceTrackToPeerConnections).toHaveBeenCalledWith(stoppedTrack, expectedTrack);
            });
        });
    });

    describe("handling localStream `stopresumevideo` event", () => {
        let localStream;
        let rtcManager;

        beforeEach(() => {
            localStream = helpers.createMockedMediaStream();
            rtcManager = createRtcManager();
            rtcManager.addNewStream("0", localStream);
        });

        describe("when enable", () => {
            it("should add track to peer connections", () => {
                jest.spyOn(rtcManager, "_addTrackToPeerConnections");
                const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

                localStream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: true, track } }));

                expect(rtcManager._addTrackToPeerConnections).toHaveBeenCalledWith(track);
            });

            it("should replace track in peer connection(s) when stopped track exists", () => {
                const stoppedTrack = helpers.createMockedMediaStreamTrack({ kind: "video" });
                rtcManager._stoppedVideoTrack = stoppedTrack;
                jest.spyOn(rtcManager, "_replaceTrackToPeerConnections");
                const newTrack = helpers.createMockedMediaStreamTrack({ kind: "video" });

                localStream.dispatchEvent(
                    new CustomEvent("stopresumevideo", { detail: { enable: true, track: newTrack } })
                );

                expect(rtcManager._replaceTrackToPeerConnections).toHaveBeenCalledWith(stoppedTrack, newTrack);
            });
        });

        describe("when disable", () => {
            it("should store disabled track", () => {
                const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

                localStream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: false, track } }));

                expect(rtcManager._stoppedVideoTrack).toEqual(track);
            });
        });
    });
});
