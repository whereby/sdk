import * as baseRtcManagerSpec from "./baseRtcManagerSpec";
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

            expect(actual).to.equal(true);
        });

        it("should return false if the provided selfId is different from the current one", () => {
            const actual = rtcManager.isInitializedWith({
                selfId: selfId + "-1212",
                roomName,
                isSfu: false,
            });

            expect(actual).to.equal(false);
        });

        it("should return false if the provided roomName is different from the current one", () => {
            const actual = rtcManager.isInitializedWith({
                selfId,
                roomName: roomName + "+somethingmore",
                isSfu: false,
            });

            expect(actual).to.equal(false);
        });

        it("should return false if isSfu is set", () => {
            const actual = rtcManager.isInitializedWith({
                selfId,
                roomName,
                isSfu: true,
            });

            expect(actual).to.equal(false);
        });
    });

    describe("_connect", () => {
        const iceServers = helpers.createIceServersConfig();

        it("creates a new peer connection", () => {
            createRtcManager({ iceServers })._connect(clientId);

            // The object should be constructed with the given peer connection config.
            expect(window.RTCPeerConnection).to.have.been.calledWithExactly(
                {
                    iceServers,
                    sdpSemantics: "unified-plan",
                },
                sinon.match.object
            );
        });

        it("uses latest ICE server information", () => {
            const updatedIceServers = helpers.createIceServersConfig();
            const rtcManager = createRtcManager({ iceServers });
            rtcManager.setupSocketListeners();
            serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, { iceServers: updatedIceServers });

            rtcManager._connect(clientId);

            expect(window.RTCPeerConnection).to.have.been.calledWithExactly(
                {
                    iceServers: updatedIceServers,
                    sdpSemantics: "unified-plan",
                },
                sinon.match.object
            );
        });

        it("defaults to creating a new peer connection with unified semantics", () => {
            createRtcManager({ iceServers })._connect(clientId, {});

            expect(window.RTCPeerConnection).to.have.been.calledWithExactly(
                { sdpSemantics: "unified-plan", iceServers },
                sinon.match.object
            );
        });

        it("creates a new peer connection with iceTransports set to relay if useOnlyTurn feature is set", () => {
            createRtcManager({ iceServers, features: { useOnlyTURN: true } })._connect(clientId, {});

            // The object should be constructed some TURN servers and iceTransportPolicy set to 'relay'.
            expect(window.RTCPeerConnection).to.have.been.calledWithExactly(
                { iceTransportPolicy: "relay", sdpSemantics: "unified-plan", iceServers },
                sinon.match.object
            );
        });

        it("stores the new peer connection", async () => {
            const rtcManager = createRtcManager();
            const { pc } = await rtcManager._connect(clientId);

            // The pc should be added to list of peer connections.
            expect(rtcManager.peerConnections[clientId].pc).to.equal(pc);
        });

        it("registers callbacks on the peer connection", async () => {
            const { pc } = await createRtcManager()._connect(clientId);

            // Callback functions should have been attached.
            expect(pc.onnegotiationneeded).to.be.a("function");
            expect(pc.onicecandidate).to.be.a("function");
            expect(pc.ontrack).to.be.a("function");
            expect(pc.oniceconnectionstatechange).to.be.a("function");
        });

        it("creates an offer", async () => {
            const { pc } = await createRtcManager()._connect(clientId);

            // An offer was created.
            expect(pc.createOffer).to.have.been.called();
        });

        it("does not emit a response on the server socket", () => {
            createRtcManager()._connect(clientId);

            expect(serverSocket.emit).not.to.have.been.called();
        });
    });

    describe("accept", () => {
        it("registers a callback for oniceconnectionstatechange on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.oniceconnectionstatechange).to.be.a("function");
        });

        it("registers a callback for onnegotiationneeded on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.onnegotiationneeded).to.be.a("function");
        });

        it("registers a callback for onicecandidate on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.onicecandidate).to.be.a("function");
        });

        it("registers a callback for ontrack on the peer connection", async () => {
            const { pc } = await createRtcManager().accept({ clientId });

            expect(pc.ontrack).to.be.a("function");
        });
    });

    describe("peerConnection callback", () => {
        describe("onnegotiationneeded", () => {
            it("negotiates the peer connection after it is connected", async () => {
                const { pc } = await createRtcManager().accept({ clientId });
                pc.iceConnectionState = "connected";
                pc.oniceconnectionstatechange();

                pc.onnegotiationneeded();

                expect(pc.createOffer).to.have.been.calledWithExactly(sinon.match.object);
            });

            it('does not negotiate peer connection when iceConnectionState is "new"', async () => {
                const { pc } = await createRtcManager().accept({ clientId });

                pc.iceConnectionState = "new";
                pc.onnegotiationneeded();

                expect(pc.createOffer).not.to.have.been.called();
            });

            it("does not re-negotiate peer connection during initial negotiation", async () => {
                const { pc } = await createRtcManager().accept({ clientId });

                // during initial negotiation, iceConnectionState changes from "new" before the
                // oniceconnectionstatechanged event is delivered
                pc.iceConnectionState = "checking";
                pc.onnegotiationneeded();

                expect(pc.createOffer).not.to.have.been.called();
            });
        });

        describe("onicecandidate", () => {
            it("sends the ICE_CANDIDATE on the socket with the candidate object", async () => {
                const { pc } = await createRtcManager()._connect(clientId);

                const candidatePackage = helpers.getValidCandidatePackage();
                pc.onicecandidate({ candidate: candidatePackage });

                expect(serverSocket.emit).to.have.been.calledWithExactly(
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

                expect(serverSocket.emit).to.have.been.calledWithExactly(
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
            let clock;

            beforeEach(() => {
                rtcManager = createRtcManager();
                clock = sinon.useFakeTimers();
            });

            afterEach(() => {
                clock.restore();
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
                        clock.tick(0);

                        expect(emitter.emit).to.have.been.calledWithExactly(
                            CONNECTION_STATUS.EVENTS.CLIENT_CONNECTION_STATUS_CHANGED,
                            {
                                clientId,
                                streamIds: [],
                                status: CONNECTION_STATUS.TYPES[expectedStatus],
                                previous: sinon.match.any,
                            }
                        );
                    });
                });
            });

            it("should call rtcManager._maybeRestartIce with the client id if the client sent the offer on disconnect", async () => {
                sinon.spy(rtcManager, "_maybeRestartIce");
                const { pc } = await rtcManager._connect(clientId);

                pc.iceConnectionState = "disconnected";
                pc.localDescription = { type: "offer" };
                pc.oniceconnectionstatechange();

                clock.tick(5000);
                expect(rtcManager._maybeRestartIce).to.have.been.calledWithExactly(clientId, sinon.match.object);
            });

            it("should call rtcManager.maybeRestartIce with the client id if the client sent the offer on failed", async () => {
                sinon.spy(rtcManager, "_maybeRestartIce");
                const { pc } = await rtcManager._connect(clientId);

                pc.iceConnectionState = "disconnected";
                pc.localDescription = { type: "offer" };
                pc.oniceconnectionstatechange();

                clock.tick(5000);
                expect(rtcManager._maybeRestartIce).to.have.been.calledWithExactly(clientId, sinon.match.object);
            });
        });
    });

    describe("stopOrResumeVideo", () => {
        let clock;
        let localStream;
        let rtcManager;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            localStream = helpers.createMockedMediaStream();
            rtcManager = createRtcManager();
        });

        afterEach(() => {
            clock.restore();
        });

        describe("when disabling", () => {
            it("should stop the video track after 5 seconds", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).not.to.have.been.called();
                clock.tick(5000);
                expect(videoTrack.stop).to.have.been.called();
            });

            it("should NOT stop track if it is still enabled", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = true;

                rtcManager.stopOrResumeVideo(localStream, false);

                expect(videoTrack.stop).not.to.have.been.called();
                clock.tick(5000);
                expect(videoTrack.stop).not.to.have.been.called();
            });

            it("should remove the track from local stream", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                clock.tick(5000);

                expect(localStream.removeTrack).to.have.been.calledWithExactly(videoTrack);
            });

            it("should emit event", () => {
                const videoTrack = localStream.getVideoTracks()[0];
                videoTrack.enabled = false;

                rtcManager.stopOrResumeVideo(localStream, false);
                clock.tick(5000);

                expect(emitter.emit).to.have.been.calledWithExactly(
                    CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_REMOVED,
                    {
                        stream: localStream,
                        track: videoTrack,
                    }
                );
            });
        });

        describe("when enabling", () => {
            let gumStream;
            let gumStub;

            beforeEach(() => {
                gumStream = helpers.createMockedMediaStream();
                gumStub = sinon.stub(navigator.mediaDevices, "getUserMedia").resolves(gumStream);
                localStream.removeTrack(localStream.getVideoTracks()[0]);
            });

            afterEach(() => {
                gumStub.restore();
            });

            it("should obtain new video track with existing constraints", () => {
                mediaContstraints = { video: { some: "constraint" } };

                rtcManager.stopOrResumeVideo(localStream, true);

                expect(navigator.mediaDevices.getUserMedia).to.have.been.calledWithExactly({
                    video: mediaContstraints.video,
                });
            });

            it("should add video track to local stream", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(localStream.addTrack).to.have.been.calledWithExactly(expectedTrack);
            });

            it("should emit event", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(emitter.emit).to.have.been.calledWithExactly(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                    streamId: localStream.id,
                    tracks: [expectedTrack],
                    screenShare: false,
                });
            });

            it("should add track to peer connection(s)", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                sinon.spy(rtcManager, "_addTrackToPeerConnections");

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(rtcManager._addTrackToPeerConnections).to.have.been.calledWithExactly(expectedTrack);
            });

            it("should replace track in peer connection(s) when stopped track exists", async () => {
                const expectedTrack = gumStream.getVideoTracks()[0];
                const stoppedTrack = helpers.createMockedMediaStreamTrack({ kind: "video" });
                rtcManager._stoppedVideoTrack = stoppedTrack;
                sinon.spy(rtcManager, "_replaceTrackToPeerConnections");

                await rtcManager.stopOrResumeVideo(localStream, true);

                expect(rtcManager._replaceTrackToPeerConnections).to.have.been.calledWithExactly(
                    stoppedTrack,
                    expectedTrack
                );
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
                sinon.spy(rtcManager, "_addTrackToPeerConnections");
                const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

                localStream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: true, track } }));

                expect(rtcManager._addTrackToPeerConnections).to.have.been.calledWithExactly(track);
            });

            it("should replace track in peer connection(s) when stopped track exists", () => {
                const stoppedTrack = helpers.createMockedMediaStreamTrack({ kind: "video" });
                rtcManager._stoppedVideoTrack = stoppedTrack;
                sinon.spy(rtcManager, "_replaceTrackToPeerConnections");
                const newTrack = helpers.createMockedMediaStreamTrack({ kind: "video" });

                localStream.dispatchEvent(
                    new CustomEvent("stopresumevideo", { detail: { enable: true, track: newTrack } })
                );

                expect(rtcManager._replaceTrackToPeerConnections).to.have.been.calledWithExactly(
                    stoppedTrack,
                    newTrack
                );
            });
        });

        describe("when disable", () => {
            it("should store disabled track", () => {
                const track = helpers.createMockedMediaStreamTrack({ kind: "video" });

                localStream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { enable: false, track } }));

                expect(rtcManager._stoppedVideoTrack).to.equal(track);
            });
        });
    });
});
