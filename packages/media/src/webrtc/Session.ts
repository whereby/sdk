import * as sdpModifier from "./sdpModifier";
import { setVideoBandwidthUsingSetParameters } from "./rtcrtpsenderHelper";
import adapterRaw from "webrtc-adapter";
import Logger from "../utils/Logger";
import { RtcStatsConnection } from "./rtcStatsService";
import { CustomMediaStreamTrack } from "./types";
import { P2PIncrementAnalyticMetric } from "./P2pRtcManager";

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
    _incrementAnalyticMetric: P2PIncrementAnalyticMetric;
    _rtcStats: RtcStatsConnection;

    constructor({
        peerConnectionId,
        bandwidth,
        deprioritizeH264Encoding,
        incrementAnalyticMetric,
        rtcStats,
    }: {
        peerConnectionId: any;
        bandwidth: any;
        deprioritizeH264Encoding: any;
        incrementAnalyticMetric: P2PIncrementAnalyticMetric;
        rtcStats: RtcStatsConnection;
    }) {
        this.peerConnectionId = peerConnectionId;
        this._rtcStats = rtcStats;
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
        this._incrementAnalyticMetric = incrementAnalyticMetric;
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
        const sdp = sdpModifier.filterMsidSemantic(message.sdp);

        const desc = { type: message.type, sdp };
        return this._setRemoteDescription(desc).then(
            () => {
                return setVideoBandwidthUsingSetParameters(this.pc, this.bandwidth);
            },
            (e: any) => {
                logger.warn("Could not set remote description from remote answer: ", e);
            },
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
            if (adapter.browserDetails?.browser === "safari" && candidate && candidate.candidate === "") {
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

    replaceTrack(oldTrack: CustomMediaStreamTrack | undefined | null, newTrack: MediaStreamTrack) {
        const pc = this.pc;
        // This shouldn't really happen
        if (!pc) {
            // ...and if it does not, we'll remove this guard.
            this._rtcStats.sendEvent("P2PReplaceTrackNoPC", {
                oldTrackId: oldTrack?.id,
                newTrackId: newTrack?.id,
            });
            this._incrementAnalyticMetric("P2PReplaceTrackNoPC");
            return false;
        }
        const senders = pc.getSenders() as RTCRtpSender[];
        // If we didn't specify oldTrack, try to find a previously added track of the same kind
        const oldTrackFallback = senders.find((s: RTCRtpSender) => s.track?.kind === newTrack.kind)?.track;
        const oldTrackToReplace = oldTrack || oldTrackFallback;

        // Modern browsers makes things simple.
        // @ts-ignore
        if (window.RTCRtpSender && window.RTCRtpSender.prototype.replaceTrack) {
            if (oldTrackToReplace) {
                const process = () => {
                    for (let i = 0; i < senders.length; i++) {
                        const sender: RTCRtpSender = senders[i];
                        const track = sender.track;
                        if (track?.id === newTrack.id) {
                            return Promise.resolve(newTrack);
                        }
                        if (track?.id === oldTrackToReplace.id) {
                            return senders[i].replaceTrack(newTrack);
                        }
                    }
                    return null;
                };
                const result = process();
                if (result) {
                    return result;
                }

                // If we have an oldtrack, we should not go forward, because
                // we already know that the track has been added at least to the mediastream
                return new Promise((resolve, reject) => {
                    let retried = 0;
                    let timer: any = setInterval(async () => {
                        const trackReplacedPromise = process();
                        if (!trackReplacedPromise) {
                            if (3 < ++retried) {
                                clearInterval(timer);
                                timer = null;

                                // Add some analytics to get more context when we end up here.
                                const sendersAnalytics = senders.map((s) => {
                                    const track: CustomMediaStreamTrack | null = s.track;
                                    if (track) {
                                        return {
                                            id: track.id,
                                            kind: track.kind,
                                            readyState: track.readyState,
                                            replaced: track.replaced,
                                        };
                                    }
                                });
                                this._rtcStats.sendEvent("P2PReplaceTrackFailed", {
                                    newTrackId: newTrack?.id,
                                    oldTrackId: oldTrack?.id,
                                    oldTrackFallbackId: oldTrackFallback?.id,
                                    sendersCount: senders?.length,
                                    sendersAnalytics,
                                });

                                reject("No sender track to replace");
                            }
                            return;
                        }
                        clearInterval(timer);
                        timer = null;
                        const trackReplaced = await trackReplacedPromise;
                        resolve(trackReplaced);
                    }, 1000);
                });
            }
            const stream =
                this.streams.find((s) => s.getTracks().find((t: any) => t.id === newTrack.id)) || this.streams[0];
            if (!stream) {
                return Promise.reject(new Error("replaceTrack: No stream?"));
            }
            // Let's just add the track if we couldn't figure out a better way.
            // We'll get here if you had no camera and plugged one in.
            return pc.addTrack(newTrack, stream);
        }

        if (!this.canModifyPeerConnection()) {
            this.pending.push(() => {
                this.replaceTrack(oldTrackToReplace, newTrack);
            });
            return;
        }
        this.isOperationPending = true;
        const onn = pc.onnegotiationneeded;
        pc.onnegotiationneeded = null;
        if (oldTrackToReplace) {
            this.removeTrack(oldTrackToReplace);
        }
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
                    !excludedTrackIds.includes(videoTransceiver?.sender?.track?.id),
            )
            .forEach((videoTransceiver: any) => {
                videoTransceiver.direction = enable ? "sendonly" : "sendrecv";
            });
    }
}
