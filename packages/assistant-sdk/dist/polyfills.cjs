'use strict';

var ws = require('ws');
var wrtc = require('@roamhq/wrtc');
var uuid = require('uuid');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function setWebsocketOrigin(roomUrl) {
    try {
        const url = new URL(roomUrl);
        global.window.location.pathname = url.pathname;
        const defaultClientOptions = {
            origin: url.origin,
        };
        class OriginAwareWebsocket extends ws {
            constructor(url, protocol, clientOptions = {}) {
                super(url, protocol, Object.assign(Object.assign({}, defaultClientOptions), clientOptions));
            }
        }
        global.WebSocket = OriginAwareWebsocket;
    }
    catch (e) {
        console.error(e);
    }
}
const wrtcMediaDevices = wrtc.mediaDevices;
global.navigator = {
    userAgent: "Node.js/20",
    mediaDevices: {
        getUserMedia: wrtc.getUserMedia,
        addEventListener: wrtcMediaDevices.addEventListener,
        removeEventListener: wrtcMediaDevices.removeEventListener,
        enumerateDevices: () => __awaiter(void 0, void 0, void 0, function* () {
            return new Promise((resolve) => resolve([
                {
                    deviceId: "default",
                    groupId: uuid.v4(),
                    kind: "audioinput",
                    label: "Dummy audio device",
                },
            ]));
        }),
    },
};
class DOMException {
    constructor(...args) {
        console.error("DOMException", args);
    }
}
class RTCPeerConnection extends wrtc.RTCPeerConnection {
    constructor() {
        super(...arguments);
        this.wrappedGetStats = wrtc.RTCPeerConnection.prototype.getStats.bind(this);
    }
    getStats(arg) {
        return __awaiter(this, void 0, void 0, function* () {
            arg = arg instanceof Object ? arg : undefined;
            const stats = yield this.wrappedGetStats(arg);
            return stats;
        });
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
global.window = Object.assign(Object.assign({}, global), { location: { pathname: "" }, screen: { width: 0 }, setInterval: global.setInterval });

exports.setWebsocketOrigin = setWebsocketOrigin;
