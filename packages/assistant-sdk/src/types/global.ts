export {};
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type * as wrtc from "@roamhq/wrtc";

declare global {
    interface MediaStream extends wrtc.MediaStream {}
    interface MediaStreamTrack extends wrtc.MediaStreamTrack {}
    interface RTCDataChannel extends wrtc.RTCDataChannel {}
    interface RTCDataChannelEvent extends wrtc.RTCDataChannelEvent {}
    interface RTCDtlsTransport extends wrtc.RTCDtlsTransport {}
    interface RTCIceCandidate extends wrtc.RTCIceCandidate {}
    interface RTCIceTransport extends wrtc.RTCIceTransport {}
    interface RTCPeerConnection extends wrtc.RTCPeerConnection {}
    interface RTCPeerConnectionIceEvent extends wrtc.RTCPeerConnectionIceEvent {}
    interface RTCRtpReceiver extends wrtc.RTCRtpReceiver {}
    interface RTCRtpSender extends wrtc.RTCRtpSender {}
    interface RTCRtpTransceiver extends wrtc.RTCRtpTransceiver {}
    interface RTCSctpTransport extends wrtc.RTCSctpTransport {}
    interface RTCSessionDescription extends wrtc.RTCSessionDescription {}
}
