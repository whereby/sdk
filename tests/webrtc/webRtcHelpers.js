import ServerSocket from "../../src/utils/ServerSocket";

export function createServerSocketStub() {
    const listeners = {};
    const socket = sinon.createStubInstance(ServerSocket);

    socket.on = sinon.spy((eventName, handler) => {
        if (!listeners[eventName]) {
            listeners[eventName] = [];
        }

        listeners[eventName].push(handler);

        return () => {
            listeners[eventName] = listeners[eventName].filter((existingHandler) => {
                return existingHandler !== handler;
            });
        };
    });

    socket.once = sinon.spy((eventName, handler) => {
        const cleanUp = socket.on(eventName, function () {
            cleanUp();
            handler.apply(null, arguments);
        });
    });

    socket.isConnected = sinon.stub().returns(true);

    socket.emit = sinon.stub();

    return {
        socket,

        emitFromServer(eventName, data) {
            listeners[eventName].forEach((func) => {
                func(data);
            });
        },

        getAllListeners() {
            return listeners;
        },

        getListeners(eventName) {
            return listeners[eventName] || [];
        },
    };
}

export function createRTCPeerConnectionStub() {
    return sinon.spy(() => {
        return {
            addIceCandidate: sinon.stub().returns(Promise.resolve()),
            createOffer: sinon.stub().returns(Promise.resolve({ type: "offer", sdp: "blob" })),
            createAnswer: sinon.stub().returns(Promise.resolve({ type: "answer", sdp: "blob" })),
            addStream: sinon.stub(),
            removeStream: sinon.stub(),
            setRemoteDescription: sinon.stub().returns(Promise.resolve()),
            setLocalDescription: sinon.stub().returns(Promise.resolve()),
            signalingState: "stable",
            addEventListener: sinon.stub(),
            close: sinon.stub(),
            getSenders: sinon.stub().returns([]),
        };
    });
}

export function getValidCandidatePackage() {
    return {
        candidate: "candidate:2720095036 1 udp 2122194687 10.6.1.165 65058 typ host generation 0",
    };
}

export function getValidRelayCandidatePackage() {
    return {
        sdpMid: "video",
        sdpMLineIndex: 0,
        candidate: "candidate:7 1 UDP 14745599 10.1.2.3 56163 typ relay raddr 192.168.1.2 rport 56163",
    };
}

export function createEmitterStub() {
    return {
        emit: sinon.stub(),
    };
}

export function randomString(prefix = "") {
    return prefix + Math.floor(Math.random() * 1000000000000).toString(36);
}

export function createIceServersConfig({ iceServerUrls } = {}) {
    const urls = iceServerUrls || [`turn:server-${randomString()}:443?transport=udp`];
    return urls.map((url) => ({
        url,
        urls: [url],
        username: randomString("user-"),
        credential: randomString("cred-"),
    }));
}

export function createMockedMediaStreamTrack({ kind }) {
    const raiseNotImplementedException = () => {
        throw new Error("Not Implemented function in mock");
    };
    const result = {
        enabled: true,
        id: randomString(),
        kind,
        label: null,
        muted: false,
        onended: null,
        onmute: null,
        onunmute: null,
        readyState: "live",
        applyConstraints: () => {
            raiseNotImplementedException();
        },
        clone: () => {
            return {
                ...result,
            };
        },
        getCapabilities: () => {
            raiseNotImplementedException();
        },
        getConstraints: () => {
            raiseNotImplementedException();
        },
        getSettings: () => {
            raiseNotImplementedException();
        },
        stop: sinon.spy(() => {
            result.enabled = false;
            result.readyState = "ended";
        }),
    };
    return result;
}

export function createMockedMediaStream() {
    const mockedAudioTrack = createMockedMediaStreamTrack({
        kind: "audio",
    });
    const mockedVideoTrack = createMockedMediaStreamTrack({
        kind: "video",
    });

    let tracks = [mockedAudioTrack, mockedVideoTrack];

    const result = {
        active: true,
        ended: false,
        id: randomString(),
        addTrack: sinon.spy((track) => tracks.push(track)),
        removeTrack: sinon.spy((track) => {
            tracks = tracks.filter((t) => t !== track);
        }),
        getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
        getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
        getTracks: () => [].concat(result.getAudioTracks(), result.getVideoTracks()),
        close: () => {
            result.active = false;
            result.ended = true;
        },
        clone: () => {
            return {
                ...result,
            };
        },
        getTrackById: (trackId) => {
            const foundTracks = result.getTracks().filter((track) => track.id === trackId);
            if (foundTracks.length < 1) {
                return null;
            }
            return foundTracks[0];
        },
    };
    return result;
}
