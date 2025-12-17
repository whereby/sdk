import * as sdpModifier from "./sdpModifier";
import { setVideoBandwidthUsingSetParameters } from "./rtcrtpsenderHelper";
import adapterRaw from "webrtc-adapter";
import Logger from "../utils/Logger";
import rtcStats from "./rtcStatsService";
import { CustomMediaStreamTrack } from "./types";
import { P2PIncrementAnalyticMetric } from "./P2pRtcManager";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;
const logger = new Logger();

interface P2PSessionOptions {
    peerConnectionId: string;
    clientId: string;
    bandwidth: number;
    peerConnectionConfig: RTCConfiguration;
    deprioritizeH264Encoding: boolean;
    shouldAddLocalVideo: boolean;
    incrementAnalyticMetric: P2PIncrementAnalyticMetric;
}

export default class Session {
    peerConnectionId: any;
    relayCandidateSeen: boolean;
    serverReflexiveCandidateSeen: boolean;
    publicHostCandidateSeen: boolean;
    ipv6HostCandidateSeen: boolean;
    ipv6HostCandidateTeredoSeen: boolean;
    ipv6HostCandidate6to4Seen: boolean;
    mdnsHostCandidateSeen: boolean;
    pc: RTCPeerConnection;
    wasEverConnected: boolean;
    connectionStatus: any;
    stats: { totalSent: number; totalRecv: number };
    bandwidth: any;
    pending: any[];
    isOperationPending: boolean;
    streamIds: any[];
    streams: MediaStream[];
    earlyIceCandidates: any[];
    afterConnected: Promise<unknown>;
    registerConnected: any;
    offerOptions: { offerToReceiveAudio: boolean; offerToReceiveVideo: boolean };
    _deprioritizeH264Encoding: any;
    clientId: any;
    peerConnectionConfig: RTCConfiguration;
    shouldAddLocalVideo: boolean;
    signalingState: any;
    srdComplete: any;
    _incrementAnalyticMetric: P2PIncrementAnalyticMetric;

    constructor({
        peerConnectionId,
        clientId,
        bandwidth,
        peerConnectionConfig,
        deprioritizeH264Encoding,
        shouldAddLocalVideo,
        incrementAnalyticMetric,
    }: P2PSessionOptions) {
        this.peerConnectionId = peerConnectionId;
        this.relayCandidateSeen = false;
        this.serverReflexiveCandidateSeen = false;
        this.publicHostCandidateSeen = false;
        this.ipv6HostCandidateSeen = false;
        this.ipv6HostCandidateTeredoSeen = false;
        this.ipv6HostCandidate6to4Seen = false;
        this.mdnsHostCandidateSeen = false;

        // Create PC.
        this.peerConnectionConfig = peerConnectionConfig;
        this.shouldAddLocalVideo = shouldAddLocalVideo;
        this.clientId = clientId;
        this.pc = new RTCPeerConnection(this.peerConnectionConfig);
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
            rtcStats.sendEvent("P2PNoAddTrackSupport", {});
            // legacy addStream fallback.
            // @ts-ignore
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
                // @ts-ignore
            } else if (this.pc.removeStream) {
                // @ts-ignore
                this.pc.removeStream(stream);
            }
        } else {
            rtcStats.sendEvent("P2PRemoveStreamNoPC", {});
            this._incrementAnalyticMetric("P2PRemoveStreamNoPC");
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

    handleOffer(message: RTCSessionDescription) {
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

    handleAnswer(message: RTCSessionDescription) {
        const sdp = sdpModifier.filterMsidSemantic(message.sdp);

        const desc = { type: message.type, sdp };
        return this._setRemoteDescription(desc).then(() => {
            return setVideoBandwidthUsingSetParameters(this.pc, this.bandwidth);
        });
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

    replaceTrack(oldTrack: CustomMediaStreamTrack | undefined, newTrack: CustomMediaStreamTrack | undefined) {
        logger.info("replacetrack() [oldTrackId: %s, newTrackId: %s]", oldTrack?.id, newTrack?.id);
        if (!newTrack) {
            rtcStats.sendEvent("P2PReplaceTrackNoNewTrack", {});
            this._incrementAnalyticMetric("P2PReplaceTrackNoNewTrack");
            return false;
        }

        if (newTrack.readyState === "ended") {
            rtcStats.sendEvent("P2PReplaceTrackNewTrackEnded", {});
            this._incrementAnalyticMetric("P2PReplaceTrackNewTrackEnded");
            return false;
        }

        const pc = this.pc as RTCPeerConnection | undefined;
        // This shouldn't really happen
        if (!pc) {
            // ...and if it does not, we'll remove this guard.
            rtcStats.sendEvent("P2PReplaceTrackNoPC", {
                oldTrackId: oldTrack?.id,
                newTrackId: newTrack?.id,
            });
            this._incrementAnalyticMetric("P2PReplaceTrackNoPC");
            return false;
        }

        // Modern browsers makes things simple.
        // @ts-ignore
        if (window.RTCRtpSender?.prototype?.replaceTrack) {
            if (oldTrack) {
                const sender = pc.getSenders().find((s) => s.track?.id === oldTrack.id);
                if (sender) {
                    sender.replaceTrack(newTrack);
                    return Promise.resolve(newTrack);
                }
            }
            // We may already have added a non-screenshare track of same kind.
            // If so, we replace it even if it's not the track given as oldTrack.
            // Ideally, this should never happen if the function was called correctly.
            const sender = pc.getSenders().find((s) => {
                const track = s.track as CustomMediaStreamTrack;
                return track?.kind === newTrack.kind && track?.sourceKind !== "screenshare";
            });
            if (sender) {
                this._incrementAnalyticMetric("P2PReplaceTrackOldTrackNotFound");
                const track = sender.track as CustomMediaStreamTrack;
                rtcStats.sendEvent("P2PReplaceTrackOldTrackNotFound", {
                    id: track?.id,
                    kind: track?.kind,
                    sourceKind: track.sourceKind,
                    readyState: track.readyState,
                });
                sender.replaceTrack(newTrack);
                return Promise.resolve(newTrack);
            }

            // We falsely believe we've already added a track that we now want to replace.
            let stream = this.streams.find((s: MediaStream) =>
                s.getTracks().find((t: MediaStreamTrack) => t.id === newTrack.id),
            );
            if (!stream) {
                rtcStats.sendEvent("P2PReplaceTrackNewTrackNotInStream", {});
                this._incrementAnalyticMetric("P2PReplaceTrackNewTrackNotInStream");
            }
            // TODO: Don't depend on array index for the stream.
            stream = this.streams[0];
            if (!stream) {
                rtcStats.sendEvent("P2PReplaceTrackNoStream", {});
                this._incrementAnalyticMetric("P2PReplaceTrackNoStream");
                return Promise.reject(new Error("replaceTrack: No stream?"));
            }
            return pc.addTrack(newTrack, stream);
        }
        // Let's see if this ever happens.
        rtcStats.sendEvent("P2PNoReplaceTrackSupport", {});

        if (!this.canModifyPeerConnection()) {
            this.pending.push(() => {
                this.replaceTrack(oldTrack, newTrack);
            });
            return;
        }
        this.isOperationPending = true;
        const onn = pc.onnegotiationneeded;
        pc.onnegotiationneeded = null;
        if (oldTrack) {
            this.removeTrack(oldTrack);
        }
        this.addTrack(newTrack);
        setTimeout(() => {
            // negotiationneeded is fired async, restore it async.
            pc.onnegotiationneeded = onn;
        }, 0);

        if (pc.localDescription?.type === "offer") {
            return pc
                .createOffer()
                .then((offer: any) => {
                    offer.sdp = sdpModifier.replaceSSRCs(pc.localDescription?.sdp, offer.sdp);
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
                    answer.sdp = sdpModifier.replaceSSRCs(pc.localDescription?.sdp, answer.sdp);
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

        // @ts-ignore
        if (this.pc.localDescription?.type === "") {
            // Let's see if this ever happens.
            this._incrementAnalyticMetric("P2PChangeBandwidthEmptySDPType");
            return;
        }

        if (!this.pc.localDescription) {
            return;
        }

        setVideoBandwidthUsingSetParameters(this.pc, this.bandwidth);
    }

    setAudioOnly(enable: boolean, excludedTrackIds: string[] = []) {
        this.pc
            ?.getTransceivers()
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
