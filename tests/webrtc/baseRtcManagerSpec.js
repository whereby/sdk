import * as helpers from "./webRtcHelpers";
import * as CONNECTION_STATUS from "../../src/model/connectionStatusConstants";
import { RELAY_MESSAGES, PROTOCOL_REQUESTS, PROTOCOL_RESPONSES } from "../../src/model/protocol";

const sdpLines = [
    "v=0",
    "o=jdoe 2890844526 2890842807 IN IP4 10.0.1.1",
    "s=",
    "c=IN IP4 192.0.2.3",
    "t=0 0",
    "a=ice-pwd:asd88fgpdd777uzjYhagZg",
    "a=ice-ufrag:8hhY",
    "m=audio 45664 RTP/AVP 0",
    "b=RS:0",
    "b=RR:0",
    "a=rtpmap:0 PCMU/8000",
    "a=candidate:1 1 UDP 2130706431 10.0.1.1 8998 typ host",
    "a=candidate:2 1 UDP 1694498815 192.0.2.3 45664 typ srflx raddr",
    "a=candidate:7 1 UDP 14745599 10.1.2.3 56163 typ relay raddr 192.168.1.2 rport 56163",
];

function getValidSdpString() {
    return sdpLines.join("\n");
}

export function test(createRtcManager) {
    describe("baseRtcManager", () => {
        const roomData = {
            mediaserverConfigTtlSeconds: 60,
        };

        let clock;
        let rtcManager;
        let emitterStub;
        let serverSocketStub;
        let serverSocket;
        let iceServers;
        let clientId;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            clientId = helpers.randomString("client-");
            window.RTCPeerConnection = helpers.createRTCPeerConnectionStub();

            iceServers = helpers.createIceServersConfig();
            emitterStub = helpers.createEmitterStub();
            serverSocketStub = helpers.createServerSocketStub();
            serverSocket = serverSocketStub.socket;
            rtcManager = createRtcManager({ emitter: emitterStub, serverSocket, iceServers, roomData });
        });

        afterEach(() => {
            clock.restore();
            delete window.RTCPeerConnection;
        });

        describe("disconnectAll", () => {
            it("should support being called without setupSocketListerners being called", () => {
                expect(() => {
                    rtcManager.disconnectAll();
                }).to.not.throw();
            });

            it("should deregister all listeners defined at setup", () => {
                const deregisterFunctions = [];
                serverSocketStub.on = () => {
                    const deregisterFunc = sinon.stub();
                    deregisterFunctions.push(deregisterFunc);
                    return deregisterFunc;
                };
                rtcManager.setupSocketListeners();

                rtcManager.disconnectAll();

                deregisterFunctions.forEach((deregisterFunction) => {
                    expect(deregisterFunction).to.have.be.calledWithExactly();
                });
            });
        });

        describe("setupSocketListeners", () => {
            it("should attach all RTC listeners", () => {
                rtcManager.setupSocketListeners();

                expect(serverSocket.on).to.have.been.calledWithExactly(
                    RELAY_MESSAGES.READY_TO_RECEIVE_OFFER,
                    sinon.match.func
                );
                expect(serverSocket.on).to.have.been.calledWithExactly(RELAY_MESSAGES.SDP_OFFER, sinon.match.func);
                expect(serverSocket.on).to.have.been.calledWithExactly(RELAY_MESSAGES.SDP_ANSWER, sinon.match.func);
                expect(serverSocket.on).to.have.been.calledWithExactly(RELAY_MESSAGES.ICE_CANDIDATE, sinon.match.func);
            });

            describe("callbacks", () => {
                beforeEach(() => {
                    rtcManager.setupSocketListeners();
                });

                describe("READY_TO_RECEIVE_OFFER", () => {
                    it("calls rtcManager._connect", () => {
                        sinon.stub(rtcManager, "_connect");

                        serverSocketStub.emitFromServer(RELAY_MESSAGES.READY_TO_RECEIVE_OFFER, {
                            clientId,
                            iceServers: {},
                        });

                        expect(rtcManager._connect).to.have.been.calledWithExactly(clientId);
                    });
                });

                describe("SDP_OFFER", () => {
                    it("sets the remote description", async () => {
                        const { pc } = await rtcManager._connect(clientId);

                        // Run
                        const validSdp = (getValidSdpString() + "\n").split("\n").join("\r\n");
                        const offer = { type: "offer", sdpU: validSdp };

                        serverSocketStub.emitFromServer(RELAY_MESSAGES.SDP_OFFER, { clientId, message: offer });

                        // Assert
                        expect(pc.setRemoteDescription).called;
                    });
                });

                describe("SDP_ANSWER", () => {
                    it("sets the remote description", async () => {
                        // Instantiate the mocked pc
                        const { pc } = await rtcManager._connect(clientId);

                        // Run
                        const validSdp = (getValidSdpString() + "\n").split("\n").join("\r\n");
                        const answer = { type: "offer", sdp: validSdp };
                        serverSocketStub.emitFromServer(RELAY_MESSAGES.SDP_ANSWER, { clientId, message: answer });

                        // Assert
                        expect(pc.setRemoteDescription).called;
                    });
                });

                describe("MEDIASERVER_CONFIG", () => {
                    const mediaserverConfigTtlSeconds = 3600;
                    const sfuServer = { url: helpers.randomString("sfu-") + ":443" };
                    const iceServers = helpers.createIceServersConfig();

                    function mockServerResponse() {
                        serverSocket.emit.resetHistory();
                        serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, {
                            mediaserverConfigTtlSeconds,
                            iceServers,
                            sfuServer,
                        });
                    }

                    it("schedules refresh on join", () => {
                        clock.tick(roomData.mediaserverConfigTtlSeconds * 1000);

                        expect(serverSocket.emit).to.have.been.calledWithExactly(
                            PROTOCOL_REQUESTS.FETCH_MEDIASERVER_CONFIG,
                            sinon.match.any,
                            sinon.match.any
                        );
                    });

                    it("updates internal media server records", () => {
                        mockServerResponse();

                        expect(rtcManager._iceServers).to.equal(iceServers);
                        expect(rtcManager._sfuServer).to.equal(sfuServer);
                    });

                    it("issues refresh request when TTL expires", () => {
                        mockServerResponse();

                        clock.tick(mediaserverConfigTtlSeconds * 1000);

                        expect(serverSocket.emit).to.have.been.calledWithExactly(
                            PROTOCOL_REQUESTS.FETCH_MEDIASERVER_CONFIG,
                            sinon.match.any,
                            sinon.match.any
                        );
                    });

                    it("clears refresh timeout when disconnected", () => {
                        mockServerResponse();

                        rtcManager.disconnectAll();
                        clock.tick(mediaserverConfigTtlSeconds * 1000);

                        expect(serverSocket.emit).to.not.have.been.called();
                    });
                });
            });
        });

        describe("accept", () => {
            it("creates a new peer connection", () => {
                rtcManager.accept({ clientId });

                // The object should be constructed with the given ice servers.
                expect(window.RTCPeerConnection).to.have.been.calledWithExactly(
                    { iceServers, sdpSemantics: "unified-plan" },
                    sinon.match.object
                );
            });

            it("stores the new peer connection", async () => {
                const { pc } = await rtcManager.accept({ clientId });

                // The pc should be added to list of peer connections.
                expect(rtcManager.peerConnections[clientId].pc).to.equal(pc);
            });

            it("does not create an offer", async () => {
                const { pc } = await rtcManager.accept({ clientId });

                // An offer should not have been created yet.
                expect(pc.createOffer).not.to.have.been.called();
            });

            it("emits READY_TO_RECEIVE_OFFER on the server socket", () => {
                rtcManager.accept({ clientId });

                expect(serverSocketStub.socket.emit).to.have.been.calledWithExactly(
                    RELAY_MESSAGES.READY_TO_RECEIVE_OFFER,
                    { receiverId: clientId },
                    undefined
                );
            });
        });

        describe("peerConnection callback", () => {
            describe("ontrack", () => {
                const fakeStream = helpers.randomString("stream-");
                const fakeTrack = helpers.randomString("track-");
                it("broadcasts a STREAM_ADDED event on the root scope", async () => {
                    const { pc } = await rtcManager.accept({ clientId });

                    pc.ontrack({ track: fakeTrack, streams: [fakeStream] });

                    expect(emitterStub.emit).to.have.been.calledWithExactly(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                        clientId,
                        stream: fakeStream,
                    });
                });

                it("does not call pc.addStream on camera/mic stream", async () => {
                    const { pc } = await rtcManager.accept({ clientId });
                    rtcManager.localStreams = { 0: fakeStream };

                    pc.ontrack({ track: fakeTrack, streams: [fakeStream] });

                    expect(pc.addStream).not.to.have.been.called();
                });

                it("does not call pc.addStream for remaining local streams if Firefox", async () => {
                    const { pc } = await rtcManager.accept({ clientId });
                    rtcManager.localStreams = { 1: fakeStream };
                    rtcManager.peerConnections[clientId].isFirefox = true;

                    pc.ontrack({ track: fakeTrack, streams: [fakeStream] });

                    expect(pc.addStream).not.to.have.been.called();
                });
            });

            describe("connectionstatechange", () => {
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
                            const { pc } = await rtcManager.accept({ clientId });

                            pc.iceConnectionState = iceState;
                            pc.localDescription = { type: "offer" };

                            pc.oniceconnectionstatechange();

                            clock.tick(0);

                            expect(emitterStub.emit).to.have.been.calledWithExactly(
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

        describe("numberOfPeerconnections", () => {
            it("returns the number of peerconnection objects", () => {
                expect(rtcManager.numberOfPeerconnections()).to.equal(0);
            });
        });
    });
}
