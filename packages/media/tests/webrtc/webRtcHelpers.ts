import WS from "jest-websocket-mock";

import { ServerSocket } from "../../src/utils/ServerSocket";
import { SsrcStats } from "../../src/webrtc/stats/types";
jest.mock("../../src/utils/ServerSocket");

export function mockSsrcStats(): SsrcStats {
    return {
        startTime: Math.random(),
        updated: Math.random(),
        pcIndex: Math.random(),
        direction: undefined,
        bitrate: Math.random(),
        fractionLost: Math.random(),
        height: Math.random(),
        lossRatio: Math.random(),
        pliRate: Math.random(),
        fps: Math.random(),
        audioLevel: Math.random(),
        audioConcealment: Math.random(),
        audioDeceleration: Math.random(),
        audioAcceleration: Math.random(),
        sourceHeight: Math.random(),
        jitter: Math.random(),
        roundTripTime: Math.random(),
        codec: undefined,
        byteCount: Math.random(),
        kind: undefined,
        ssrc: Math.random(),
        mid: Math.random(),
        rid: undefined,
        nackCount: Math.random(),
        nackRate: Math.random(),
        packetCount: Math.random(),
        packetRate: Math.random(),
        headerByteCount: Math.random(),
        mediaRatio: Math.random(),
        sendDelay: Math.random(),
        retransRatio: Math.random(),
        width: Math.random(),
        qualityLimitationReason: undefined,
        pliCount: Math.random(),
        firCount: Math.random(),
        firRate: Math.random(),
        kfCount: Math.random(),
        kfRate: Math.random(),
        frameCount: Math.random(),
        qpf: Math.random(),
        encodeTime: Math.random(),
        sourceWidth: Math.random(),
        sourceFps: Math.random(),
    };
}
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

export function createRTCPeerConnectionStub(
    {
        receivers = [],
        senders = [],
        stats = new Map(),
    }: { receivers?: RTCRtpReceiver[]; senders?: RTCRtpSender[]; stats?: Map<string, unknown> } = {
        receivers: [] as RTCRtpReceiver[],
        senders: [] as RTCRtpSender[],
        stats: new Map(),
    },
) {
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
            getReceivers: jest.fn(() => receivers),
            getSenders: jest.fn(() => senders),
            getStats: jest.fn(() => stats),
        } as unknown as RTCPeerConnection;
    });
}

export function createRTCTrancieverStub<T extends RTCRtpReceiver | RTCRtpSender>(
    { stats, track } = { stats: new Map(), track: createMockedMediaStreamTrack({ kind: "video" }) },
): () => T {
    return jest.fn(() => {
        return {
            getStats: jest.fn(() => stats),
            track,
        } as unknown as T;
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
    return Object.assign(new EventTarget(), result) as unknown as MediaStreamTrack;
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

export class MockTransport {
    on = jest.fn().mockReturnValue({ on: jest.fn() });
    observer = {
        once: jest.fn(),
    };
    produce = ({ track }: { track: MediaStreamTrack }) => {
        return new MockProducer({ kind: track.kind });
    };
    close = jest.fn();
}

export class MockProducer {
    kind: string;

    constructor({ kind }: { kind: string }) {
        this.kind = kind;
    }

    id = "id";
    resume = jest.fn();
    pause = jest.fn();
    observer = {
        once: jest.fn(),
    };
    paused = false;
    replaceTrack = ({ track }: { track: any }) => {
        this.track = track;
    };
    track = undefined;
}

export const createSfuWebsocketServer = (): {
    wss: WS;
    url: string;
} => {
    const portsInUse = [];
    const getPort = (exludePorts: number[]): number => {
        let port;
        do {
            port = Math.floor(Math.random() * 64510) + 1024;
        } while (exludePorts.includes(port));
        return port;
    };

    let wss;
    let port;
    let url;
    while (!wss || !url) {
        try {
            port = getPort(portsInUse);
            url = "wss://localhost:" + port;
            wss = new WS(url);

            wss.on("connection", function connection(socket) {
                socket.on("message", function message(message) {
                    const { method, id } = JSON.parse(message.toString());
                    if (method === "getCapabilities") {
                        socket.send(JSON.stringify({ response: true, id, ok: true }));
                    }
                    if (method === "createTransport") {
                        socket.send(
                            JSON.stringify({
                                id,
                                ok: true,
                                response: true,
                            }),
                        );
                    }
                });
            });
        } catch (e) {
            if (port) portsInUse.push(port);
            port = undefined;
        }
    }

    url = url.split("wss://")[1];

    return { wss, url };
};
