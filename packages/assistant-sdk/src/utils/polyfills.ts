// @ts-nocheck
import ws from "ws";
import wrtc from "@roamhq/wrtc";
import { v4 as uuid } from "uuid";

export function setWebsocketOrigin(roomUrl: string) {
    try {
        // add pathname needed for parsing in rtcstats-server.
        const url = new URL(roomUrl);
        global.window.location.pathname = url.pathname;

        // fix origin header needed for parsing in rtcstats-server.
        const defaultClientOptions = {
            origin: url.origin,
        };

        class OriginAwareWebsocket extends ws {
            constructor(url: string, protocol: string, clientOptions = {}) {
                super(url, protocol, { ...defaultClientOptions, ...clientOptions });
            }
        }
        global.WebSocket = OriginAwareWebsocket as unknown as typeof global.WebSocket;
    } catch (e) {
        console.error(e);
    }
}

const wrtcMediaDevices = wrtc.mediaDevices as {
    addEventListener: EventTarget["addEventListener"];
    removeEventListener: EventTarget["removeEventListener"];
};
Object.defineProperty(global, "navigator", {
    value: {
        userAgent: "Node.js/20",
        mediaDevices: {
            getUserMedia: wrtc.getUserMedia as (args: { audio: boolean; video: boolean }) => Promise<MediaStream>,
            addEventListener: wrtcMediaDevices.addEventListener,
            removeEventListener: wrtcMediaDevices.removeEventListener,
            enumerateDevices: async () =>
                new Promise((resolve) =>
                    resolve([
                        {
                            deviceId: "default",
                            groupId: uuid(),
                            kind: "audioinput",
                            label: "Dummy audio device",
                        },
                    ]),
                ),
        },
    },
    writable: false,
    enumerable: true,
    configurable: true,
});
class DOMException {
    constructor(...args) {
        console.error("DOMException", args);
    }
}
class RTCPeerConnection extends wrtc.RTCPeerConnection {
    private wrappedGetStats = wrtc.RTCPeerConnection.prototype.getStats.bind(this);
    async getStats(arg: unknown) {
        /**
         * node-wrtc seems to expect an Object argument, and doesn't handle the null arg we pass, so we
         * wrap the call and filter the arg
         **/
        arg = arg instanceof Object ? arg : undefined;
        const stats = await this.wrappedGetStats(arg);
        return stats;
    }
}

global.DOMException = DOMException;

global.WebSocket = ws;

global.MediaStream = wrtc.MediaStream;
global.MediaStreamTrack = wrtc.MediaStreamTrack;
global.RTCDataChannel = wrtc.RTCDataChannel;
global.RTCDataChannelEvent = wrtc.RTCDataChannelEvent;
global.RTCDtlsTransport = wrtc.RTCDtlsTransport;
global.RTCIceCandidate = wrtc.RTCIceCandidate;
global.RTCIceTransport = wrtc.RTCIceTransport;
global.RTCPeerConnection = RTCPeerConnection;
global.RTCPeerConnectionIceEvent = wrtc.RTCPeerConnectionIceEvent;
global.RTCRtpReceiver = wrtc.RTCRtpReceiver;
global.RTCRtpSender = wrtc.RTCRtpSender;
global.RTCRtpTransceiver = wrtc.RTCRtpTransceiver;
global.RTCSctpTransport = wrtc.RTCSctpTransport;
global.RTCSessionDescription = wrtc.RTCSessionDescription;
global.window = {
    ...global,
    location: { pathname: "" },
    screen: { width: 0 },
    setInterval: global.setInterval,
}; // make sure all the classes / setInterval are available on window for rtcstats
