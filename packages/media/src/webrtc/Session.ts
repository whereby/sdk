import * as sdpModifier from "./sdpModifier";
import * as statsHelper from "./statsHelper";
import { setVideoBandwidthUsingSetParameters } from "./rtcrtpsenderHelper";
import adapterRaw from "webrtc-adapter";
import { MAXIMUM_TURN_BANDWIDTH_UNLIMITED } from "./constants";
import Logger from "../utils/Logger";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;
const logger = new Logger();

export default class Session {
    peerConnectionId: any;
    relayCandidateSeen: boolean;
    serverReflexiveCandidateSeen: boolean;
    publicHostCandidateSeen: boolean;
    ipv6HostCandidateSeen: boolean;
    ipv6HostCandidateTeredoSeen: boolean;
    ipv6HostCandidate6to4Seen: boolean;
    mdnsHostCandidateSeen: boolean;
    pc: any;
    wasEverConnected: boolean;
    connectionStatus: any;
    stats: { totalSent: number; totalRecv: number };
    bandwidth: any;
    maximumTurnBandwidth: any;
    pending: any[];
    isOperationPending: boolean;
    streamIds: any[];
    streams: any[];
    earlyIceCandidates: any[];
    afterConnected: Promise<unknown>;
    registerConnected: any;
    offerOptions: { offerToReceiveAudio: boolean; offerToReceiveVideo: boolean };
    _deprioritizeH264Encoding: any;
    clientId: any;
    peerConnectionConfig: any;
    shouldAddLocalVideo: any;
    signalingState: any;
    srdComplete: any;
    pendingOffer: any;

    constructor({
        peerConnectionId,
        bandwidth,
        maximumTurnBandwidth,
        deprioritizeH264Encoding,
    }: {
        peerConnectionId: any;
        bandwidth: any;
        maximumTurnBandwidth: any;
        deprioritizeH264Encoding: any;
    }) {
        this.peerConnectionId = peerConnectionId;
        this.relayCandidateSeen = false;
        this.serverReflexiveCandidateSeen = false;
        this.publicHostCandidateSeen = false;
        this.ipv6HostCandidateSeen = false;
        this.ipv6HostCandidateTeredoSeen = false;
        this.ipv6HostCandidate6to4Seen = false;
        this.mdnsHostCandidateSeen = false;

        this.pc = null;
        this.wasEverConnected = false;
        this.connectionStatus = null;
        this.stats = {
            totalSent: 0,
            totalRecv: 0,
        };
        this.bandwidth = bandwidth || 0; // maximum bandwidth in kbps.
        this.maximumTurnBandwidth = maximumTurnBandwidth;
        this.pending = [];
        this.isOperationPending = false;
        this.streamIds = [];
        this.streams = [];
        this.earlyIceCandidates = [];
        this.afterConnected = new Promise((resolve) => {
            this.registerConnected = resolve;
        });
        this.offerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
        this._deprioritizeH264Encoding = deprioritizeH264Encoding;
    }

    setAndGetPeerConnection({
        clientId,
        constraints,
        peerConnectionConfig,
        shouldAddLocalVideo,
    }: {
        clientId: any;
        constraints: any;
        peerConnectionConfig: any;
        shouldAddLocalVideo: any;
    }) {
        this.peerConnectionConfig = peerConnectionConfig;
        this.shouldAddLocalVideo = shouldAddLocalVideo;
        this.clientId = clientId;
        // this.pc = new RTCPeerConnection(peerConnectionConfig, constraints);
        this.pc = new RTCPeerConnection(peerConnectionConfig);
        this.signalingState = this.pc.signalingState;

        this.pc.addEventListener("signalingstatechange", () => {
            if (this.signalingState === this.pc.signalingState) {
                return;
            }
            this.signalingState = this.pc.signalingState;
            // implements a simple queue of pending operations
            // like doing an ice restart or setting the bandwidth
            if (this.pc.signalingState === "stable") {
                this.isOperationPending = false;
                const action = this.pending.shift();
                if (action) {
                    action.apply();
                }
            }
        });
        return this.pc;
    }

    addStream(stream: MediaStream) {
        this.streamIds.push(stream.id);
        this.streams.push(stream);
        // @ts-ignore
        if (RTCPeerConnection.prototype.addTrack) {
            stream.getAudioTracks().forEach((track) => {
                this.pc.addTrack(track, stream);
            });
            stream.getVideoTracks().forEach((track) => {
                this.pc.addTrack(track, stream);
            });
        } else {
            // legacy addStream fallback.
            this.pc.addStream(stream);
        }
    }

    addTrack(track: MediaStreamTrack, stream?: MediaStream) {
        if (!stream) {
            stream = this.streams[0];
        }
        stream?.addTrack(track);
        this.pc.addTrack(track, stream);
    }

    removeTrack(track: MediaStreamTrack) {
        const stream = this.streams[0];
        stream.removeTrack(track);
        const sender = this.pc.getSenders().find((sender: any) => sender.track === track);
        if (sender) {
            this.pc.removeTrack(sender);
        }
    }

    removeStream(stream: MediaStream) {
        for (let i = 0; i < this.streamIds.length; i++) {
            if (this.streamIds[i] === stream.id) {
                this.streamIds.splice(i, 1);
                this.streams.splice(i, 1);
            }
        }

        if (this.pc) {
            if (this.pc.removeTrack) {
                stream.getTracks().forEach((track) => {
                    const sender = this.pc.getSenders().find((sender: any) => sender.track === track);
                    if (sender) {
                        this.pc.removeTrack(sender);
                    }
                });
            } else if (this.pc.removeStream) {
                this.pc.removeStream(stream);
            }
        }
    }

    _setRemoteDescription(desc: any) {
        // deprioritize H264 Encoding if set by option/flag
        if (this._deprioritizeH264Encoding) desc.sdp = sdpModifier.deprioritizeH264(desc.sdp);

        // wrapper around SRD which stores a promise
        this.srdComplete = this.pc.setRemoteDescription(desc);
        return this.srdComplete.then(() => {
            this.earlyIceCandidates.forEach((candidate) => this.pc.addIceCandidate(candidate));
            this.earlyIceCandidates = [];
        });
    }

    handleOffer(message: any) {
        if (!this.canModifyPeerConnection()) {
            return new Promise((resolve) => {
                this.pending.push(() => this.handleOffer(message).then(resolve));
            });
        }
        this.isOperationPending = true;
        let sdp = message.sdp;

        sdp = sdpModifier.filterMidExtension(sdp);
        sdp = sdpModifier.filterMsidSemantic(sdp);

        const desc = { type: message.type, sdp };
        // Create an answer to send to the client that sent the offer
        let answerToSignal: any;

        return this._setRemoteDescription(desc)
            .then(() => {
                return this.pc.createAnswer();
            })
            .then((answer: any) => {
                answerToSignal = answer;
                return this.pc.setLocalDescription(answer);
            })
            .then(() => {
                return setVideoBandwidthUsingSetParameters(this.pc, this.bandwidth);
            })
            .then(() => {
                return answerToSignal;
            });
    }

    handleAnswer(message: any) {
        // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394602
        if (this.pendingOffer) {
            const pendingOffer = this.pendingOffer;
            delete this.pendingOffer;
            return this.pc.setLocalDescription(pendingOffer).then(() => this.handleAnswer(message));
        }
        let sdp = message.sdp;

        sdp = sdpModifier.filterMsidSemantic(sdp);

        const desc = { type: message.type, sdp };
        return this._setRemoteDescription(desc).then(
            () => {
                return setVideoBandwidthUsingSetParameters(this.pc, this.bandwidth);
            },
            (e: any) => {
                logger.warn("Could not set remote description from remote answer: ", e);
            }
        );
    }

    addIceCandidate(candidate: any) {
        if (!this.srdComplete) {
            // In theory this is a protocol violation. However, our Javascript can signal an
            // answer after the first candidates.
            this.earlyIceCandidates.push(candidate);
            return;
        }
        this.srdComplete.then(() => {
            if (this.pc.signalingState === "closed") {
                return;
            }
            if (adapter.browserDetails.browser === "safari" && candidate && candidate.candidate === "") {
                // filter due to https://github.com/webrtcHacks/adapter/issues/863
                return;
            }
            this.pc.addIceCandidate(candidate).catch((e: any) => {
                logger.warn("Failed to add ICE candidate ('%s'): %s", candidate ? candidate.candidate : null, e);
            });
        });
    }

    canModifyPeerConnection() {
        return this.pc.signalingState === "stable" && !this.isOperationPending;
    }

    close() {
        const pc = this.pc;
        if (!pc) {
            return;
        }

        pc.oniceconnectionstatechange = null;
        pc.onicecandidate = null;
        pc.ontrack = null;
        try {
            // do not handle state change events when we close the connection explicitly
            pc.close();
        } catch (e) {
            logger.warn("failures during close of session", e);
            // we're not interested in errors from RTCPeerConnection.close()
        }
    }

    hasConnectedPeerConnection() {
        return this.pc && this.pc.connectionState === "connected";
    }

    replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack) {
        const pc = this.pc;
        // This shouldn't really happen
        if (!pc) return false;
        const senders = pc.getSenders();
        function dbg(msg: string) {
            const tr = (t: any) => t && `id:${t.id},kind:${t.kind},state:${t.readyState}`;
            logger.warn(
                `${msg}. newTrack:${tr(newTrack)}, oldTrack:${tr(oldTrack)}, sender tracks: ${JSON.stringify(
                    senders.map((s: any) => `s ${tr(s.track)}`)
                )}, sender first codecs: ${JSON.stringify(senders.map((s: any) => (s.getParameters().codecs || [])[0]))}`
            );
        }
        if (!senders.length) {
            dbg("No senders!");
        }
        // If we didn't specify oldTrack, replace with first of its kind
        if (!oldTrack) {
            oldTrack = (senders.find((s: any) => s.track && s.track.kind === newTrack.kind) || {}).track;
            if (!oldTrack) {
                // odin: Temporary debug data, remove if you see after 2020-12-01
                dbg("No sender with same kind! Add new track then.");
            }
        }
        // Modern browsers makes things simple.
        // @ts-ignore
        if (window.RTCRtpSender && window.RTCRtpSender.prototype.replaceTrack) {
            if (oldTrack) {
                const process = () => {
                    for (let i = 0; i < senders.length; i++) {
                        const sender = senders[i];
                        const track = sender.track;
                        if (!sender && !track) {
                            // odin: Temporary debug data, remove if you see after 2020-12-01
                            dbg("One of the tracks is null!");
                        }
                        if (track.id === newTrack.id) {
                            return Promise.resolve(newTrack);
                        }
                        if (track.id === oldTrack.id) {
                            return senders[i].replaceTrack(newTrack);
                        }
                    }
                    return null;
                };
                let result = process();
                if (result) {
                    return result;
                }
                let resolve: any = null;
                let reject: any = null;
                result = new Promise((_resolve, _reject) => {
                    resolve = _resolve;
                    reject = _reject;
                });
                let retried = 0;
                let timer: any = setInterval(async () => {
                    const trackReplacedPromise = process();
                    if (!trackReplacedPromise) {
                        if (3 < ++retried) {
                            clearInterval(timer);
                            timer = null;
                            dbg("No sender track to replace");
                            reject("No sender track to replace");
                        }
                        return;
                    }
                    clearInterval(timer);
                    timer = null;
                    const trackReplaced = await trackReplacedPromise;
                    resolve(trackReplaced);
                }, 1000);
                // if we have an oldtrack, we should not go forward, because
                // we already know that the track has been added at least to the mediastream
                return result;
            }
            const stream =
                this.streams.find((s) => s.getTracks().find((t: any) => t.id === newTrack.id)) || this.streams[0];
            if (!stream) {
                dbg("No stream?");
                return Promise.reject(new Error("replaceTrack: No stream?"));
            }
            // Let's just add the track if we couldn't figure out a better way.
            // We'll get here if you had no camera and plugged one in.
            return pc.addTrack(newTrack, stream);
        }

        if (!this.canModifyPeerConnection()) {
            this.pending.push(() => {
                this.replaceTrack(oldTrack, newTrack);
            });
            return;
        }
        this.isOperationPending = true;
        const onn = pc.onnegotiationneeded;
        pc.onnegotiationneeded = null;
        this.removeTrack(oldTrack);
        this.addTrack(newTrack);
        setTimeout(() => {
            // negotiationneeded is fired async, restore it async.
            pc.onnegotiationneeded = onn;
        }, 0);

        if (pc.localDescription.type === "offer") {
            return pc
                .createOffer()
                .then((offer: any) => {
                    offer.sdp = sdpModifier.replaceSSRCs(pc.localDescription.sdp, offer.sdp);
                    return pc.setLocalDescription(offer);
                })
                .then(() => {
                    return this._setRemoteDescription(pc.remoteDescription);
                });
        } else {
            return this._setRemoteDescription(pc.remoteDescription)
                .then(() => {
                    return pc.createAnswer();
                })
                .then((answer: any) => {
                    answer.sdp = sdpModifier.replaceSSRCs(pc.localDescription.sdp, answer.sdp);
                    return pc.setLocalDescription(answer);
                });
        }
    }

    // Restricts the bandwidth based on whether we are using a relayed connection.
    // No signaling is required, this is done independently by both sides.
    // Only applies to unrestricted connections, not affecting the bandwidth tables
    // that depend on the number of participants.
    maybeRestrictRelayBandwidth() {
        if (this.maximumTurnBandwidth === MAXIMUM_TURN_BANDWIDTH_UNLIMITED) {
            return;
        }
        if (!this.pc.getStats) {
            return;
        }
        statsHelper.isRelayed(this.pc).then((isRelayed: boolean) => {
            if (isRelayed && this.bandwidth === 0) {
                this.changeBandwidth(this.maximumTurnBandwidth);
            }
        });
    }

    // no-signaling negotiation of bandwidth. Peer is NOT informed.
    // Prefers using RTCRtpSender.setParameters if possible.
    changeBandwidth(bandwidth: any) {
        // don't renegotiate if bandwidth is already set.
        if (bandwidth === this.bandwidth) {
            return;
        }

        if (!this.canModifyPeerConnection()) {
            this.pending.push(() => this.changeBandwidth(bandwidth));
            return;
        }

        this.bandwidth = bandwidth;
        if (!this.pc.localDescription || this.pc.localDescription.type === "") {
            return;
        }

        setVideoBandwidthUsingSetParameters(this.pc, this.bandwidth);
    }

    setAudioOnly(enable: boolean, excludedTrackIds: any[] = []) {
        this.pc
            .getTransceivers()
            .filter(
                (videoTransceiver: any) =>
                    videoTransceiver?.direction !== "recvonly" &&
                    videoTransceiver?.receiver?.track?.kind === "video" &&
                    !excludedTrackIds.includes(videoTransceiver?.receiver?.track?.id) &&
                    !excludedTrackIds.includes(videoTransceiver?.sender?.track?.id)
            )
            .forEach((videoTransceiver: any) => {
                videoTransceiver.direction = enable ? "sendonly" : "sendrecv";
            });
    }
}
