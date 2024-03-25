jest.mock("webrtc-adapter", () => {
    return {
        browserDetails: { browser: "chrome" },
    };
});

import * as helpers from "./webRtcHelpers";
import { itShouldThrowIfMissing } from "../helpers";
import * as CONNECTION_STATUS from "../../src/model/connectionStatusConstants";
import P2pRtcManager from "../../src/webrtc/P2pRtcManager";
import rtcManagerEvents from "../../src/webrtc/rtcManagerEvents";

import { RELAY_MESSAGES, PROTOCOL_REQUESTS, PROTOCOL_RESPONSES } from "../../src/model/protocol";

const originalNavigator = global.navigator;

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

describe("P2pRtcManager", () => {
    let navigator: any;
    let serverSocketStub: any;
    let serverSocket: any;
    let emitter: any;
    let webrtcProvider: any;
    let clientId: any;
    let mediaContstraints: any;

    beforeEach(() => {
        // @ts-ignore
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
        // @ts-ignore
        delete window.RTCPeerConnection;
    });

    /**
     * These are tests from the old parent class BaseRtcManager.
     * SFU and P2P used to inherit the same base manager.
     */
    describe("old parent class baseRtcManager test", () => {
        const roomData = {
            mediaserverConfigTtlSeconds: 60,
        };

        let rtcManager: any;
        let emitterStub: any;
        let serverSocketStub: any;
        let serverSocket: any;
        let iceServers: any;
        let clientId: any;

        beforeEach(() => {
            jest.useFakeTimers();
            clientId = helpers.randomString("client-");
            // @ts-ignore
            window.RTCPeerConnection = helpers.createRTCPeerConnectionStub();

            iceServers = helpers.createIceServersConfig();
            emitterStub = helpers.createEmitterStub();
            serverSocketStub = helpers.createServerSocketStub();
            serverSocket = serverSocketStub.socket;
            rtcManager = createRtcManager({ emitter: emitterStub, serverSocket, iceServers, roomData });
        });

        afterEach(() => {
            jest.useRealTimers();
            // @ts-ignore
            delete window.RTCPeerConnection;
        });

        describe("disconnectAll", () => {
            it("should support being called without setupSocketListerners being called", () => {
                expect(() => {
                    rtcManager.disconnectAll();
                }).not.toThrow();
            });

            it("should deregister all listeners defined at setup", () => {
                const deregisterFunctions: any = [];
                serverSocketStub.on = () => {
                    const deregisterFunc = jest.fn();
                    deregisterFunctions.push(deregisterFunc);
                    return deregisterFunc;
                };
                rtcManager.setupSocketListeners();

                rtcManager.disconnectAll();

                deregisterFunctions.forEach((deregisterFunction: any) => {
                    expect(deregisterFunction).toHaveBeenCalled();
                });
            });
        });

        describe("setupSocketListeners", () => {
            it("should attach all RTC listeners", () => {
                rtcManager.setupSocketListeners();

                expect(serverSocket.on).toHaveBeenCalledWith(
                    RELAY_MESSAGES.READY_TO_RECEIVE_OFFER,
                    expect.any(Function)
                );
                expect(serverSocket.on).toHaveBeenCalledWith(RELAY_MESSAGES.SDP_OFFER, expect.any(Function));
                expect(serverSocket.on).toHaveBeenCalledWith(RELAY_MESSAGES.SDP_ANSWER, expect.any(Function));
                expect(serverSocket.on).toHaveBeenCalledWith(RELAY_MESSAGES.ICE_CANDIDATE, expect.any(Function));
            });

            describe("callbacks", () => {
                beforeEach(() => {
                    rtcManager.setupSocketListeners();
                });

                describe(PROTOCOL_RESPONSES.ROOM_JOINED, () => {
                    it("ignores sfu mode", () => {
                        jest.spyOn(rtcManager, "_emitServerEvent");

                        serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.ROOM_JOINED, {
                            room: {
                                sfuServer: "bogus-sfu.whereby.com",
                            },
                        });

                        expect(rtcManager._emitServerEvent).not.toHaveBeenCalled();
                    });

                    it("is noop if client was not screensharing", () => {
                        jest.spyOn(rtcManager, "_emitServerEvent");
                        const mockStream = {
                            getAudioTracks: jest.fn(),
                        };
                        jest.spyOn(mockStream, "getAudioTracks").mockReturnValue([]);
                        rtcManager._wasScreenSharing = false;
                        rtcManager.enabledLocalStreamIds = ["0", "screenShareStreamId"];
                        rtcManager.localStreams = { 0: {}, screenShareStreamId: mockStream };

                        serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.ROOM_JOINED, {
                            room: {},
                        });

                        expect(rtcManager._emitServerEvent).not.toHaveBeenCalled();
                    });

                    it(`sends ${PROTOCOL_REQUESTS.START_SCREENSHARE} if reconnecting during screenshare`, () => {
                        jest.spyOn(rtcManager, "_emitServerEvent");
                        const mockStream = {
                            getAudioTracks: jest.fn(),
                        };
                        jest.spyOn(mockStream, "getAudioTracks").mockReturnValue([]);
                        rtcManager._wasScreenSharing = true;
                        rtcManager.enabledLocalStreamIds = ["0", "screenShareStreamId"];
                        rtcManager.localStreams = { 0: {}, screenShareStreamId: mockStream };

                        serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.ROOM_JOINED, {
                            room: {},
                        });

                        expect(rtcManager._emitServerEvent).toHaveBeenCalledWith(PROTOCOL_REQUESTS.START_SCREENSHARE, {
                            hasAudioTrack: false,
                            streamId: "screenShareStreamId",
                        });
                    });
                });

                describe("READY_TO_RECEIVE_OFFER", () => {
                    it("calls rtcManager._connect", () => {
                        jest.spyOn(rtcManager, "_connect");

                        serverSocketStub.emitFromServer(RELAY_MESSAGES.READY_TO_RECEIVE_OFFER, {
                            clientId,
                            iceServers: {},
                        });

                        expect(rtcManager._connect).toHaveBeenCalledWith(clientId);
                    });
                });

                describe("SDP_OFFER", () => {
                    it("sets the remote description", async () => {
                        const session = await rtcManager._connect(clientId);
                        const validSdp = (getValidSdpString() + "\n").split("\n").join("\r\n");
                        const offer = { type: "offer", sdpU: validSdp };

                        session.isOperationPending = false; // HACK
                        serverSocketStub.emitFromServer(RELAY_MESSAGES.SDP_OFFER, { clientId, message: offer });

                        expect(session.pc.setRemoteDescription).toHaveBeenCalled();
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
                        expect(pc.setRemoteDescription).toHaveBeenCalled();
                    });
                });

                describe("MEDIASERVER_CONFIG", () => {
                    const mediaserverConfigTtlSeconds = 3600;
                    const sfuServer = { url: helpers.randomString("sfu-") + ":443" };
                    const iceServers = helpers.createIceServersConfig();

                    function mockServerResponse() {
                        serverSocket.emit.mockReset();
                        serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, {
                            mediaserverConfigTtlSeconds,
                            iceServers,
                            sfuServer,
                        });
                    }

                    it("schedules refresh on join", () => {
                        jest.advanceTimersByTime(roomData.mediaserverConfigTtlSeconds * 1000);

                        expect(serverSocket.emit).toHaveBeenCalledWith(
                            PROTOCOL_REQUESTS.FETCH_MEDIASERVER_CONFIG,
                            undefined,
                            undefined
                        );
                    });

                    it("updates internal media server records", () => {
                        mockServerResponse();

                        expect(rtcManager._iceServers).toEqual(iceServers);
                        expect(rtcManager._sfuServer).toEqual(sfuServer);
                    });

                    it("issues refresh request when TTL expires", () => {
                        mockServerResponse();

                        jest.advanceTimersByTime(mediaserverConfigTtlSeconds * 1000);

                        expect(serverSocket.emit).toHaveBeenCalledWith(
                            PROTOCOL_REQUESTS.FETCH_MEDIASERVER_CONFIG,
                            undefined,
                            undefined
                        );
                    });

                    it("clears refresh timeout when disconnected", () => {
                        mockServerResponse();

                        rtcManager.disconnectAll();
                        jest.advanceTimersByTime(mediaserverConfigTtlSeconds * 1000);

                        expect(serverSocket.emit).toHaveBeenCalledTimes(0);
                    });
                });
            });
        });

        describe("accept", () => {
            it("creates a new peer connection", () => {
                rtcManager.accept({ clientId });

                // The object should be constructed with the given ice servers.
                expect(window.RTCPeerConnection).toHaveBeenCalledWith({ iceServers, sdpSemantics: "unified-plan" });
            });

            it("stores the new peer connection", async () => {
                const { pc } = await rtcManager.accept({ clientId });

                // The pc should be added to list of peer connections.
                expect(rtcManager.peerConnections[clientId].pc).toEqual(pc);
            });

            it("does not create an offer", async () => {
                const { pc } = await rtcManager.accept({ clientId });

                // An offer should not have been created yet.
                expect(pc.createOffer).toHaveBeenCalledTimes(0);
            });

            it("emits READY_TO_RECEIVE_OFFER on the server socket", () => {
                rtcManager.accept({ clientId });

                expect(serverSocketStub.socket.emit).toHaveBeenCalledWith(
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

                    expect(emitterStub.emit).toHaveBeenCalledWith(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                        clientId,
                        stream: fakeStream,
                    });
                });

                it("does not call pc.addStream on camera/mic stream", async () => {
                    const { pc } = await rtcManager.accept({ clientId });
                    rtcManager.localStreams = { 0: fakeStream };

                    pc.ontrack({ track: fakeTrack, streams: [fakeStream] });

                    expect(pc.addStream).toHaveBeenCalledTimes(0);
                });

                it("does not call pc.addStream for remaining local streams if Firefox", async () => {
                    const { pc } = await rtcManager.accept({ clientId });
                    rtcManager.localStreams = { 1: fakeStream };
                    rtcManager.peerConnections[clientId].isFirefox = true;

                    pc.ontrack({ track: fakeTrack, streams: [fakeStream] });

                    expect(pc.addStream).toHaveBeenCalledTimes(0);
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
                    Object.keys(iceStateToConnectionStatus).forEach((iceState: any) => {
                        const expectedStatus = (iceStateToConnectionStatus as any)[iceState];

                        it("broadcasts when ice connection state becomes " + iceState, async () => {
                            const { pc } = await rtcManager.accept({ clientId });

                            pc.iceConnectionState = iceState;
                            pc.localDescription = { type: "offer" };

                            pc.oniceconnectionstatechange();

                            jest.advanceTimersByTime(0);

                            expect(emitterStub.emit).toHaveBeenCalledWith(
                                CONNECTION_STATUS.EVENTS.CLIENT_CONNECTION_STATUS_CHANGED,
                                expect.objectContaining({
                                    clientId,
                                    streamIds: [],
                                    status: (CONNECTION_STATUS.TYPES as any)[expectedStatus],
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

        describe("numberOfPeerconnections", () => {
            it("returns the number of peerconnection objects", () => {
                expect(rtcManager.numberOfPeerconnections()).toEqual(0);
            });
        });
    });

    describe("isInitializedWith", () => {
        const selfId = helpers.randomString("client-");
        const roomName = helpers.randomString("/room-");
        let rtcManager: any;

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
            expect(window.RTCPeerConnection).toHaveBeenCalledWith({
                iceServers,
                sdpSemantics: "unified-plan",
            });
        });

        it("uses latest ICE server information", () => {
            const updatedIceServers = helpers.createIceServersConfig();
            const rtcManager = createRtcManager({ iceServers });
            rtcManager.setupSocketListeners();
            serverSocketStub.emitFromServer(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, { iceServers: updatedIceServers });

            rtcManager._connect(clientId);

            expect(window.RTCPeerConnection).toHaveBeenCalledWith({
                iceServers: updatedIceServers,
                sdpSemantics: "unified-plan",
            });
        });

        it("defaults to creating a new peer connection with unified semantics", () => {
            createRtcManager({ iceServers })._connect(clientId);

            expect(window.RTCPeerConnection).toHaveBeenCalledWith({ sdpSemantics: "unified-plan", iceServers });
        });

        it("creates a new peer connection with iceTransports set to relay if useOnlyTurn feature is set", () => {
            createRtcManager({ iceServers, features: { useOnlyTURN: true } })._connect(clientId);

            // The object should be constructed some TURN servers and iceTransportPolicy set to 'relay'.
            expect(window.RTCPeerConnection).toHaveBeenCalledWith({
                iceTransportPolicy: "relay",
                sdpSemantics: "unified-plan",
                iceServers,
            });
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

        describe("icerestart", () => {
            it("P2pRtcManager emits ICE restart event", async () => {
                const p2pRtcManager = createRtcManager();
                const { pc } = await p2pRtcManager._connect(clientId);
                pc.iceConnectionState = "disconnected";
                pc.localDescription = { type: "offer" };
                const session: any = { pc };
                session.canModifyPeerConnection = jest.fn().mockReturnValue(true);
                p2pRtcManager._maybeRestartIce(clientId, session);
                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.ICE_RESTART, undefined);
            });
        });

        describe("onicecandidate", () => {
            it("P2pRtcManager emits new PC and no public IP gathered in 3sec events", async () => {
                const { pc } = await createRtcManager()._connect(clientId);

                const address = "192.168.1.1"; // ipv4 private rfc1918
                pc.onicegatheringstatechange({ target: { iceGatheringState: "gathering" } });
                pc.onicecandidate({ candidate: { address, type: "host" } });
                await new Promise((r) => setTimeout(r, 3001));
                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.NEW_PC, undefined);
                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.ICE_NO_PUBLIC_IP_GATHERED_3SEC, undefined);
            });
        });

        describe("onicecandidate", () => {
            it("P2pRtcManager emits no public IP gathered event", async () => {
                const { pc } = await createRtcManager()._connect(clientId);

                pc.onicegatheringstatechange({ target: { iceGatheringState: "gathering" } });
                const address = "192.168.1.1"; // ipv4 private rfc1918
                pc.onicecandidate({ candidate: { address, type: "host" } });
                pc.onicegatheringstatechange({ target: { iceGatheringState: "complete" } });
                // gathering finished
                pc.onicecandidate({ candidate: null });

                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.ICE_NO_PUBLIC_IP_GATHERED, undefined);
            });
        });

        describe("onicecandidate", () => {
            it("P2pRtcManager emits mDNS seen event", async () => {
                const { pc } = await createRtcManager()._connect(clientId);

                const address = "31703155-6932-43d7-9d9b-44dda8daea28.local"; // mDNS

                pc.onicecandidate({ candidate: { address, type: "host" } });

                // gathering finished
                pc.onicecandidate({ candidate: null });

                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.ICE_MDNS_SEEN, undefined);
            });
        });

        describe("onicecandidate", () => {
            it("P2pRtcManager emits IPv6 seen event", async () => {
                const { pc } = await createRtcManager()._connect(clientId);

                const address = "[2001:738::1]"; // ipv6 unicast global in brackets

                pc.onicecandidate({ candidate: { address, type: "host" } });

                // gathering finished
                pc.onicecandidate({ candidate: null });

                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.ICE_IPV6_SEEN, {
                    sixtofourSeen: false,
                    teredoSeen: false,
                });
            });
        });

        describe("onicecandidate", () => {
            it("P2pRtcManager emits IPv6 and mDNS seen events", async () => {
                const { pc } = await createRtcManager()._connect(clientId);

                const CANDIDATE_ADDRESSES = [
                    "31703155-6932-43d7-9d9b-44dda8daea28.local", // mDNS
                    "Invalid-UUIDv4.local", //mDNS invalid uuidv4
                    "192.168.1.1", // ipv4 private rfc1918
                    "193.6.222.1", // ipv4 public
                    "[2001:738::1]", // ipv6 unicast global in brackets
                    "2001:0000:4136:e378:8000:63bf:3fff:fdd2", //ipv6 Teredo
                    "2002:c000:0204::1", // ipv6 6to4
                    "veryverylonglineveryverylonglineveryverylonglineveryverylonglineveryverylonglineveryverylonglineveryverylonglineveryverylonglineveryverylongline", // long long invalid address
                    "", // empty address
                ];
                CANDIDATE_ADDRESSES.forEach((address) => {
                    pc.onicecandidate({ candidate: { address, type: "host" } });
                });

                // gathering finished
                pc.onicecandidate({ candidate: null });
                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.ICE_IPV6_SEEN, {
                    sixtofourSeen: true,
                    teredoSeen: true,
                });
                expect(emitter.emit).toHaveBeenCalledWith(rtcManagerEvents.ICE_MDNS_SEEN, undefined);
            });
        });

        describe("oniceconnectionstatechange", () => {
            let rtcManager: any;

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
                    const expectedStatus = (iceStateToConnectionStatus as any)[iceState];

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
                                status: (CONNECTION_STATUS.TYPES as any)[expectedStatus],
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
        let localStream: any;
        let rtcManager: any;

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
            let gumStream: any;

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
        let localStream: any;
        let rtcManager: any;

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
