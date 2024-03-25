import { ServerSocket } from "../../src/utils/ServerSocket";
jest.mock("../../src/utils/ServerSocket");

export function createServerSocketStub() {
    const listeners: any = {};

    const socket = new ServerSocket("");

    socket.on = jest.fn((eventName, handler) => {
        if (!listeners[eventName]) {
            listeners[eventName] = [];
        }

        listeners[eventName].push(handler);

        return () => {
            listeners[eventName] = listeners[eventName].filter((existingHandler: any) => {
                return existingHandler !== handler;
            });
        };
    });

    socket.once = jest.fn((eventName, handler) => {
        const cleanUp = socket.on(eventName, function () {
            cleanUp();
            handler.apply(null, arguments);
        });
    });

    socket.isConnected = jest.fn(() => true);

    socket.emit = jest.fn();

    return {
        socket,

        emitFromServer(eventName: string, data: any) {
            listeners[eventName].forEach((func: any) => {
                func(data);
            });
        },

        getAllListeners() {
            return listeners;
        },

        getListeners(eventName: string) {
            return listeners[eventName] || [];
        },
    };
}

export function createRTCPeerConnectionStub() {
    return jest.fn(() => {
        return {
            addIceCandidate: jest.fn(() => Promise.resolve()),
            createOffer: jest.fn(() => Promise.resolve({ type: "offer", sdp: "blob" })),
            createAnswer: jest.fn(() => Promise.resolve({ type: "answer", sdp: "blob" })),
            addStream: jest.fn(),
            removeStream: jest.fn(),
            setRemoteDescription: jest.fn(() => Promise.resolve()),
            setLocalDescription: jest.fn(() => Promise.resolve()),
            signalingState: "stable",
            addEventListener: jest.fn(),
            close: jest.fn(),
            getSenders: jest.fn(() => []),
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
        emit: jest.fn(),
    };
}

export function randomString(prefix = "") {
    return prefix + Math.floor(Math.random() * 1000000000000).toString(36);
}

export function createIceServersConfig({ iceServerUrls }: { iceServerUrls?: any } = {}) {
    const urls = iceServerUrls || [`turn:server-${randomString()}:443?transport=udp`];
    return urls.map((url: any) => ({
        url,
        urls: [url],
        username: randomString("user-"),
        credential: randomString("cred-"),
    }));
}

export function createMockedMediaStreamTrack({ id = randomString("track"), kind }: { id?: string; kind: string }) {
    const raiseNotImplementedException = () => {
        throw new Error("Not Implemented function in mock");
    };
    const result = {
        enabled: true,
        id,
        kind,
        label: undefined,
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
        getConstraints: () => ({ deviceId: { exact: id } }), // not really correct
        getSettings: () => ({ deviceId: id }),
        stop: jest.fn(() => {
            result.enabled = false;
            result.readyState = "ended";
        }),
    };
    return Object.assign(new EventTarget(), result);
}

export function createMockedMediaStream(existingTracks?: any) {
    let tracks = existingTracks || [
        createMockedMediaStreamTrack({
            kind: "audio",
        }),
        createMockedMediaStreamTrack({
            kind: "video",
        }),
    ];

    const result = {
        active: true,
        ended: false,
        id: randomString(),
        addTrack: jest.fn((track) => tracks.push(track)),
        removeTrack: jest.fn((track) => {
            tracks = tracks.filter((t: any) => t !== track);
        }),
        getAudioTracks: () => tracks.filter((t: any) => t.kind === "audio"),
        getVideoTracks: () => tracks.filter((t: any) => t.kind === "video"),
        getTracks: () => tracks,
        close: () => {
            result.active = false;
            result.ended = true;
        },
        clone: () => {
            return {
                ...result,
            };
        },
        getTrackById: (trackId: string) => {
            const foundTracks = tracks.filter((track: any) => track.id === trackId);
            if (foundTracks.length < 1) {
                return null;
            }
            return foundTracks[0];
        },
    };
    return Object.assign(new EventTarget(), result);
}
