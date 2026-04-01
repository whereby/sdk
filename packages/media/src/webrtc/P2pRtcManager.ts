import rtcStats from "./rtcStatsService";
import Session from "./Session";
import { MEDIA_JITTER_BUFFER_TARGET } from "./constants";
import * as webrtcBugDetector from "./bugDetector";
import { PROTOCOL_REQUESTS, RELAY_MESSAGES, PROTOCOL_RESPONSES } from "../model/protocol";
import * as CONNECTION_STATUS from "../model/connectionStatusConstants";
import { setCodecPreferenceSDP, addAbsCaptureTimeExtMap, cleanSdp } from "./sdpModifier";
import adapterRaw from "webrtc-adapter";
import ipRegex from "../utils/ipRegex";
import { Address6 } from "ip-address";
import checkIp from "check-ip";
import validate from "uuid-validate";
import rtcManagerEvents from "./rtcManagerEvents";
import Logger from "../utils/Logger";
import {
    AddCameraStreamOptions,
    RemoveScreenshareStreamOptions,
    RtcManager,
    RtcManagerOptions,
    SignalSDPMessage,
    SignalMediaServerConfig,
    WebRTCProvider,
    SignalIceCandidateMessage,
    SignalReadyToReceiveOfferMessage,
    SignalIceEndOfCandidatesMessage,
} from "./types";
import { ClearableTimeout, ScreenshareStoppedEvent, ServerSocket, sortCodecs, trackAnnotations } from "../utils";
import { maybeTurnOnly, external_stun_servers, turnServerOverride } from "../utils/iceServers";
import getConstraints from "./mediaConstraints";

interface CreateSessionOptions {
    clientId: string;
    initialBandwidth: number;
    isOfferer: boolean;
}

interface NegotiatePeerConnectionOptions {
    clientId: string;
    session: Session;
    constraints?: RTCOfferOptions;
    isInitialOffer?: boolean;
}

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;
const logger = new Logger();

const ICE_PUBLIC_IP_GATHERING_TIMEOUT = 3 * 1000;
export const ICE_RESTART_DELAY = 2 * 1000;
const browserName = adapter.browserDetails?.browser;
const browserVersion = adapter.browserDetails.version;

let unloading = false;
if (browserName === "chrome") {
    window.document.addEventListener("beforeunload", () => {
        unloading = true;
    });
}

type P2PAnalytics = {
    P2POffendingInitialOffer: number;
    P2PNonErrorRejectionValueGUMError: number;
    numNewPc: number;
    numIceConnected: number;
    numIceRestart: number;
    numIceNoPublicIpGathered: number;
    numIceNoPublicIpGatheredIn3sec: number;
    numIceIpv6Seen: number;
    numIceIpv6TeredoSeen: number;
    numIceIpv6SixToFour: number;
    numIceMdnsSeen: number;
    micTrackEndedCount: number;
    camTrackEndedCount: number;
    numPcOnAnswerFailure: number;
    numPcOnOfferFailure: number;
    numPcSldFailure: number;
    P2PChangeBandwidthEmptySDPType: number;
    P2PReplaceTrackNoStream: number;
    P2PReplaceTrackNewTrackNotInStream: number;
    P2POnTrackNoStream: number;
    P2PSetCodecPreferenceError: number;
    P2PCreateOfferNoSDP: number;
    P2PCreateAnswerNoSDP: number;
    P2PMicNotWorking: number;
    P2PLocalNetworkFailed: number;
    P2PRelayedIceCandidate: number;
    P2PStartScreenshareNoStream: number;
};

type P2PAnalyticMetric = keyof P2PAnalytics;

export type P2PIncrementAnalyticMetric = (metric: P2PAnalyticMetric) => void;

export default class P2pRtcManager implements RtcManager {
    _selfId: string;
    _roomName: string;
    _roomSessionId: string | null;
    peerConnections: Record<string, Session>;
    _localCameraStream?: MediaStream;
    _localScreenshareStream?: MediaStream;
    _screenshareVideoTrackIds: string[];
    _socketListenerDeregisterFunctions: any[];
    _localStreamDeregisterFunction: any;
    _emitter: any;
    _serverSocket: ServerSocket;
    _webrtcProvider: WebRTCProvider;
    _features: any;
    _isAudioOnlyMode: boolean;
    offerOptions: {
        offerToReceiveAudio: boolean;
        offerToReceiveVideo: boolean;
    };
    _audioTrackOnEnded: () => void;
    _videoTrackOnEnded: () => void;
    _iceServers: any;
    _turnServers: any;
    _mediaserverConfigTtlSeconds: any;
    _fetchMediaServersTimer: ClearableTimeout | null;
    _stopCameraTimeout: ClearableTimeout | null;
    _icePublicIPGatheringTimeoutID: ClearableTimeout | null;
    _stoppedVideoTrack?: MediaStreamTrack;
    _videoTrackBeingMonitored?: MediaStreamTrack;
    _audioTrackBeingMonitored?: MediaStreamTrack;
    _closed: boolean;
    analytics: P2PAnalytics;
    _rtcStatsDisconnectTimeout?: ReturnType<typeof setTimeout>;

    constructor({ selfId, room, emitter, serverSocket, webrtcProvider, features }: RtcManagerOptions) {
        const { name, session, iceServers, turnServers, mediaserverConfigTtlSeconds } = room;

        this._selfId = selfId;
        this._roomName = name;
        this._roomSessionId = session && session.id;
        this.peerConnections = {};
        this._screenshareVideoTrackIds = [];
        this._socketListenerDeregisterFunctions = [];
        this._localStreamDeregisterFunction = null;
        this._emitter = emitter;
        this._serverSocket = serverSocket;
        this._webrtcProvider = webrtcProvider;
        this._features = features || {};
        this._isAudioOnlyMode = false;
        this._closed = false;

        // Timeouts
        this._fetchMediaServersTimer = null;
        this._stopCameraTimeout = null;
        this._icePublicIPGatheringTimeoutID = null;

        this.offerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };

        this._audioTrackOnEnded = () => {
            // There are a couple of reasons the microphone could stop working.
            // One of them is getting unplugged. The other is the Chrome audio
            // process crashing. The third is the tab being closed.
            // https://bugs.chromium.org/p/chromium/issues/detail?id=1050008
            rtcStats.sendEvent("audio_ended", { unloading });
            this._emit(rtcManagerEvents.MICROPHONE_STOPPED_WORKING, {});
            this.analytics.micTrackEndedCount++;
        };

        this._videoTrackOnEnded = () => {
            rtcStats.sendEvent("video_ended", { unloading });
            this._emit(rtcManagerEvents.CAMERA_STOPPED_WORKING, {});
            this.analytics.camTrackEndedCount++;
        };

        this._updateAndScheduleMediaServersRefresh({
            iceServers: iceServers?.iceServers || [],
            turnServers: turnServers || [],
            mediaserverConfigTtlSeconds,
        });

        this.analytics = {
            P2POffendingInitialOffer: 0,
            P2PNonErrorRejectionValueGUMError: 0,
            numNewPc: 0,
            numIceConnected: 0,
            numIceRestart: 0,
            numIceNoPublicIpGathered: 0,
            numIceNoPublicIpGatheredIn3sec: 0,
            numIceIpv6Seen: 0,
            numIceIpv6TeredoSeen: 0,
            numIceIpv6SixToFour: 0,
            numIceMdnsSeen: 0,
            micTrackEndedCount: 0,
            camTrackEndedCount: 0,
            numPcSldFailure: 0,
            numPcOnAnswerFailure: 0,
            numPcOnOfferFailure: 0,
            P2PChangeBandwidthEmptySDPType: 0,
            P2PReplaceTrackNoStream: 0,
            P2PReplaceTrackNewTrackNotInStream: 0,
            P2POnTrackNoStream: 0,
            P2PSetCodecPreferenceError: 0,
            P2PCreateOfferNoSDP: 0,
            P2PCreateAnswerNoSDP: 0,
            P2PMicNotWorking: 0,
            P2PLocalNetworkFailed: 0,
            P2PRelayedIceCandidate: 0,
            P2PStartScreenshareNoStream: 0,
        };
    }

    numberOfPeerconnections() {
        return Object.keys(this.peerConnections).length;
    }

    isInitializedWith({ selfId, roomName, isSfu }: { selfId: string; roomName: string; isSfu: boolean }) {
        return this._selfId === selfId && this._roomName === roomName && !isSfu;
    }

    addCameraStream(
        stream: MediaStream,
        { beforeEffectTracks = [] }: AddCameraStreamOptions = { beforeEffectTracks: [] },
    ) {
        logger.info("addCameraStream: [stream.id: %s]", stream.id);
        if (stream === this._localCameraStream) {
            // this can happen after reconnect. We do not want to add the stream to the
            // peerconnection again.
            return;
        }

        this._localCameraStream = stream;
        this._addStreamToPeerConnections(stream);

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (audioTrack) {
            if (!trackAnnotations(audioTrack).isEffectTrack) {
                this._monitorAudioTrack(audioTrack);
            }
            const beforeEffectTrack = beforeEffectTracks.find((t) => t.kind === "audio");
            if (beforeEffectTrack) {
                this._monitorAudioTrack(beforeEffectTrack);
            }
        }

        if (videoTrack) {
            if (!trackAnnotations(videoTrack).isEffectTrack) {
                this._monitorVideoTrack(videoTrack);
            }

            const beforeEffectTrack = beforeEffectTracks.find((t) => t.kind === "video");
            if (beforeEffectTrack) {
                this._monitorVideoTrack(beforeEffectTrack);
            }
        }

        this._enableStopResumeVideoForBrowserSDK(stream);
    }

    /**
     * browser-sdk can dispatch custom `stopresumevideo` event on the localStream.
     * This function allows it to get the desired side-effects when toggling video,
     * but without maintaining a direct reference to the rtc manager itself.
     */
    _enableStopResumeVideoForBrowserSDK(stream: MediaStream) {
        // This should not be needed, but checking nonetheless
        if (this._localStreamDeregisterFunction) {
            this._localStreamDeregisterFunction();
            this._localStreamDeregisterFunction = null;
        }

        const localStreamHandler = (e: any) => {
            const { enable, track } = e.detail;
            this._handleStopOrResumeVideo({ enable, track });
        };

        stream.addEventListener("stopresumevideo", localStreamHandler);
        this._localStreamDeregisterFunction = () => {
            stream.removeEventListener("stopresumevideo", localStreamHandler);
        };
    }

    addScreenshareStream(stream: MediaStream) {
        logger.info("addScreenshareStream() [stream.id: %s]", stream.id);
        if (stream === this._localScreenshareStream) {
            // this can happen after reconnect. We do not want to add the stream to the
            // peerconnection again.
            return;
        }

        this._localScreenshareStream = stream;
        this._screenshareVideoTrackIds.push(stream.getVideoTracks()[0].id);
        this._emitServerEvent(PROTOCOL_REQUESTS.START_SCREENSHARE, {
            streamId: stream.id,
            hasAudioTrack: !!stream.getAudioTracks().length,
        });
        this._addStreamToPeerConnections(stream);
    }

    replaceTrack(oldTrack: MediaStreamTrack | null, newTrack: MediaStreamTrack) {
        logger.info(
            "replaceTrack() [kind: %s, oldTrackId: %s, newTrackId: %s]",
            newTrack.kind,
            oldTrack?.id,
            newTrack.id,
        );
        if (newTrack.kind === "audio" && !trackAnnotations(newTrack).isEffectTrack) {
            this._monitorAudioTrack(newTrack);
        }
        if (newTrack.kind === "video" && !trackAnnotations(newTrack).isEffectTrack) {
            this._monitorVideoTrack(newTrack);
        }
        return this._replaceTrackToPeerConnections(oldTrack, newTrack);
    }

    close() {
        this._closed = true;
        this.disconnectAll();
    }

    disconnectAll() {
        logger.info("disconnectAll()");
        Object.keys(this.peerConnections).forEach((clientId) => {
            this.disconnect(clientId);
        });
        this.peerConnections = {};
        this._socketListenerDeregisterFunctions.forEach((func) => {
            func();
        });
        this._socketListenerDeregisterFunctions = [];

        if (this._localStreamDeregisterFunction) {
            this._localStreamDeregisterFunction();
            this._localStreamDeregisterFunction = null;
        }

        this.rtcStatsDisconnect();
    }

    setupSocketListeners() {
        this._socketListenerDeregisterFunctions = [
            () => this._clearMediaServersRefresh(),

            this._serverSocket.on(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, (data: SignalMediaServerConfig) => {
                if (data.error) {
                    logger.warn("FETCH_MEDIASERVER_CONFIG failed:", data.error);
                    return;
                }
                this._updateAndScheduleMediaServersRefresh(data);
            }),

            this._serverSocket.on(RELAY_MESSAGES.READY_TO_RECEIVE_OFFER, (data: SignalReadyToReceiveOfferMessage) => {
                logger.info(`Got ready_to_receive_offer from client ${data.clientId}`);
                this._connect(data.clientId);
            }),

            this._serverSocket.on(RELAY_MESSAGES.ICE_CANDIDATE, (data: SignalIceCandidateMessage) => {
                logger.info(`Got ice_candidate from client ${data.clientId}`);
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on ICE_CANDIDATE", data);
                    return;
                }
                session.addIceCandidate(data.message);
            }),

            this._serverSocket.on(RELAY_MESSAGES.ICE_END_OF_CANDIDATES, (data: SignalIceEndOfCandidatesMessage) => {
                logger.info(`Got end_of_ice_candidates from client ${data.clientId}`);
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on ICE_END_OF_CANDIDATES", data);
                    return;
                }
                session.addIceCandidate(null);
            }),

            // when a new SDP offer is received from another client
            this._serverSocket.on(RELAY_MESSAGES.SDP_OFFER, (data: SignalSDPMessage) => {
                logger.info(
                    `Got offer from client ${data.clientId}, isInitialOffer: ${Boolean(data.message.isInitialOffer)}`,
                );
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on SDP_OFFER", data);
                    return;
                }
                const sdp = {
                    sdp: data.message.sdp || data.message.sdpU,
                    type: data.message.type,
                };

                // If signaling protocol supports initial offer validation we attempt it.
                if (
                    "isInitialOffer" in data.message &&
                    data.message.isInitialOffer === false &&
                    session.pc.connectionState === "new" &&
                    session.pc.iceConnectionState === "new" &&
                    !session.connectionStatus
                ) {
                    logger.info("We have asked for an initial offer, ignoring all others");
                    this.analytics.P2POffendingInitialOffer++;
                    rtcStats.sendEvent("P2POffendingInitialOffer", { clientId: session.clientId });
                    return;
                }
                session
                    .handleOffer(sdp)
                    .then((answer) => {
                        logger.info(`Sending answer to client ${data.clientId}`);
                        this._emitServerEvent(RELAY_MESSAGES.SDP_ANSWER, {
                            receiverId: data.clientId,
                            message: answer,
                        });
                    })
                    .catch?.((e: any) => {
                        logger.error(e);
                        this.analytics.numPcOnOfferFailure++;
                    });
            }),

            // when a new SDP answer is received from another client
            this._serverSocket.on(RELAY_MESSAGES.SDP_ANSWER, (data: SignalSDPMessage) => {
                logger.info(`Got answer from client ${data.clientId}`);
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on SDP_ANSWER", data);
                    return;
                }
                const sdp = {
                    sdp: data.message.sdp || data.message.sdpU,
                    type: data.message.type,
                };
                session.handleAnswer(sdp)?.catch?.((e: any) => {
                    logger.warn("Could not set remote description from remote answer: ", e);
                    this.analytics.numPcOnAnswerFailure++;
                });
            }),

            // Clean up session.streamIds after stopped screenshare from remote peer.
            this._serverSocket.on(PROTOCOL_RESPONSES.SCREENSHARE_STOPPED, (payload: ScreenshareStoppedEvent) => {
                const session = this._getSession(payload.clientId);
                if (session) {
                    const streamIdIndex = session.streamIds.indexOf(payload.streamId);
                    if (streamIdIndex !== -1) {
                        session.streamIds.splice(streamIdIndex, 1);
                    }
                }
            }),
        ];
    }

    sendAudioMutedStats(muted: boolean) {
        rtcStats.sendEvent("audio_muted", { muted });
    }

    sendVideoMutedStats(muted: boolean) {
        rtcStats.sendEvent("video_muted", { muted });
    }

    sendStatsCustomEvent(eventName: string, data: any) {
        rtcStats.sendEvent(eventName, data);
    }

    rtcStatsConnect() {
        if (!rtcStats.server.connected) {
            rtcStats.server.connect();
        }
    }

    rtcStatsDisconnect() {
        clearTimeout(this._rtcStatsDisconnectTimeout);

        rtcStats.server.close();
    }

    rtcStatsReconnect() {
        if (!rtcStats.server.connected && rtcStats.server.attemptedConnectedAtLeastOnce) {
            rtcStats.server.connect();
        }
    }

    setAudioOnly(audioOnly: boolean) {
        this._isAudioOnlyMode = audioOnly;

        this._forEachPeerConnection((session: Session) => {
            if (session.hasConnectedPeerConnection()) {
                this._withForcedRenegotiation(session, () =>
                    session.setAudioOnly(this._isAudioOnlyMode, this._screenshareVideoTrackIds),
                );
            }
        });
    }

    setRemoteScreenshareVideoTrackIds(remoteScreenshareVideoTrackIds = []) {
        this._screenshareVideoTrackIds = [...remoteScreenshareVideoTrackIds];

        const localScreenShareTrack = this._localScreenshareStream?.getVideoTracks()?.[0];
        if (localScreenShareTrack) {
            this._screenshareVideoTrackIds.push(localScreenShareTrack.id);
        }
    }

    setRoomSessionId(roomSessionId: string) {
        this._roomSessionId = roomSessionId;
    }

    _setConnectionStatus(session: Session, newStatus: string, clientId: string) {
        const previousStatus = session.connectionStatus;
        if (previousStatus === newStatus) {
            return;
        }

        // Never go from disconnected -> checking
        if (
            previousStatus === CONNECTION_STATUS.TYPES.CONNECTION_DISCONNECTED &&
            newStatus === CONNECTION_STATUS.TYPES.CONNECTING
        ) {
            return;
        }
        session.connectionStatus = newStatus;

        setTimeout(() => {
            this._emit(CONNECTION_STATUS.EVENTS.CLIENT_CONNECTION_STATUS_CHANGED, {
                streamIds: session.streamIds,
                clientId,
                status: newStatus,
                previous: previousStatus,
            });
        }, 0);
        if (newStatus === CONNECTION_STATUS.TYPES.CONNECTION_SUCCESSFUL) {
            this.analytics.numIceConnected++;
        }
    }

    _setJitterBufferTarget(pc: RTCPeerConnection) {
        try {
            const receivers = pc.getReceivers();

            receivers.forEach((receiver) => {
                receiver.jitterBufferTarget = MEDIA_JITTER_BUFFER_TARGET;
                // Legacy Chrome API
                // @ts-ignore
                receiver.playoutDelayHint = MEDIA_JITTER_BUFFER_TARGET / 1000; // seconds
            });
        } catch (error) {
            logger.error("Error during setting jitter buffer target:", error);
        }
    }

    _emitServerEvent(eventName: string, data?: any) {
        if (this._closed) {
            logger.warn("RtcManager closed. Will not send event", eventName, data);
            return;
        }
        if (this._features.awaitJoinRoomFinished && !this._serverSocket.joinRoomFinished) {
            rtcStats.sendEvent("skip_emitting_server_message", { eventName });
        } else {
            this._serverSocket.emit(eventName, data);
        }
    }

    _emit(eventName: string, data?: any) {
        this._emitter.emit(eventName, data);
    }

    _getSession(clientId: string) {
        if (!(clientId in this.peerConnections)) {
            return null;
        }
        return this.peerConnections[clientId];
    }

    _createSession({ clientId, initialBandwidth, isOfferer }: CreateSessionOptions) {
        if (!clientId) {
            throw new Error("clientId is missing");
        }

        const peerConnectionConfig: RTCConfiguration = {
            iceServers: this._features.turnServersOn ? this._turnServers : this._iceServers,
        };

        peerConnectionConfig.iceServers = turnServerOverride(
            peerConnectionConfig.iceServers,
            this._features.turnServerOverrideHost,
        );

        external_stun_servers(peerConnectionConfig, this._features);
        maybeTurnOnly(peerConnectionConfig, this._features);

        // Some macs + ios devices have troubles using h264 encoder since safari 14
        // this will make them encode VP8 instead if available
        const deprioritizeH264Encoding =
            browserName === "safari" &&
            browserVersion &&
            browserVersion >= 14 &&
            this._features.deprioritizeH264OnSafari;

        const session = new Session({
            clientId,
            peerConnectionConfig,
            bandwidth: initialBandwidth,
            deprioritizeH264Encoding,
            incrementAnalyticMetric: (metric: P2PAnalyticMetric) => this.analytics[metric]++,
        });
        this.peerConnections[clientId] = session;

        setTimeout(() => this._emit(rtcManagerEvents.NEW_PC), 0);
        this.analytics.numNewPc++;

        const { pc } = session;

        // Start of RTCPeerConnection event handlers.

        pc.onicegatheringstatechange = (event: any) => {
            const connection = event.target;

            switch (connection.iceGatheringState) {
                case "gathering":
                    if (this._icePublicIPGatheringTimeoutID) clearTimeout(this._icePublicIPGatheringTimeoutID);
                    this._icePublicIPGatheringTimeoutID = setTimeout(() => {
                        if (
                            !session.publicHostCandidateSeen &&
                            !session.relayCandidateSeen &&
                            !session.serverReflexiveCandidateSeen
                        ) {
                            if (pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed")
                                this.analytics.numIceNoPublicIpGatheredIn3sec++;
                        }
                    }, ICE_PUBLIC_IP_GATHERING_TIMEOUT);
                    break;
                case "complete":
                    if (this._icePublicIPGatheringTimeoutID) clearTimeout(this._icePublicIPGatheringTimeoutID);
                    this._icePublicIPGatheringTimeoutID = null;
                    break;
            }
        };

        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate) {
                // TODO: remove relayed candidate from ICE candidate analytics if it never happens.

                // @ts-ignore
                if (event.candidate.type === "relayed") {
                    this.analytics.P2PRelayedIceCandidate++;
                }

                switch (event.candidate.type) {
                    case "host":
                        const address = event.candidate.address;
                        if (!address) {
                            break;
                        }
                        try {
                            if (ipRegex.v4({ exact: true }).test(address)) {
                                const ipv4 = checkIp(address);
                                if (ipv4.isPublicIp) session.publicHostCandidateSeen = true;
                            } else if (ipRegex.v6({ exact: true }).test(address.replace(/^\[(.*)\]/, "$1"))) {
                                const ipv6 = new Address6(address.replace(/^\[(.*)\]/, "$1"));
                                session.ipv6HostCandidateSeen = true;

                                if (ipv6.getScope() === "Global") {
                                    session.publicHostCandidateSeen = true;
                                }
                                if (ipv6.isTeredo()) {
                                    session.ipv6HostCandidateTeredoSeen = true;
                                }
                                if (ipv6.is6to4()) {
                                    session.ipv6HostCandidate6to4Seen = true;
                                }
                            } else {
                                const uuidv4 = address.replace(/.local/, "");
                                if (uuidv4 && validate(uuidv4, 4)) {
                                    session.mdnsHostCandidateSeen = true;
                                }
                            }
                        } catch (error) {
                            logger.info("Error during parsing candidates! Error: ", { error });
                        }
                        break;
                    case "srflx":
                        session.serverReflexiveCandidateSeen = true;
                        break;
                    // TODO: remove relayed candidate from ICE candidate analytics if it never happens.
                    // @ts-ignore
                    case "relayed":
                    case "relay":
                        session.relayCandidateSeen = true;
                        break;
                    default:
                        break;
                }
                this._emitServerEvent(RELAY_MESSAGES.ICE_CANDIDATE, {
                    receiverId: clientId,
                    message: event.candidate,
                });
            } else {
                this._emitServerEvent(RELAY_MESSAGES.ICE_END_OF_CANDIDATES, {
                    receiverId: clientId,
                });
                if (
                    !session.publicHostCandidateSeen &&
                    !session.relayCandidateSeen &&
                    !session.serverReflexiveCandidateSeen &&
                    pc.iceConnectionState !== "connected" &&
                    pc.iceConnectionState !== "completed"
                ) {
                    this.analytics.numIceNoPublicIpGathered++;
                }
                if (session.ipv6HostCandidateSeen) {
                    this.analytics.numIceIpv6Seen++;
                    if (session.ipv6HostCandidate6to4Seen) this.analytics.numIceIpv6SixToFour++;
                    if (session.ipv6HostCandidateTeredoSeen) this.analytics.numIceIpv6TeredoSeen++;
                }
                if (session.mdnsHostCandidateSeen) this.analytics.numIceMdnsSeen++;
            }
        };

        pc.onnegotiationneeded = () => {
            if (pc.iceConnectionState === "new" || !session.connectionStatus) {
                // initial negotiation is handled by our CLIENT_READY/READY_TO_RECEIVE_OFFER exchange
                return;
            }
            logger.info(`onnegotiationneeded client ${clientId}`);
            this._negotiatePeerConnection({ clientId, session });
        };

        pc.ontrack = (event: RTCTrackEvent) => {
            const stream = event.streams[0];
            if (!stream) {
                this.analytics.P2POnTrackNoStream++;
                rtcStats.sendEvent("P2POnTrackNoStream", {
                    trackKind: event.track.kind,
                    trackId: event.track.id,
                });
                return;
            }
            if (session.streamIds.indexOf(stream.id) === -1) {
                session.streamIds.push(stream.id);
                this._emit(CONNECTION_STATUS.EVENTS.STREAM_ADDED as string, {
                    clientId,
                    stream,
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            logger.info(`iceConnectionState changed to ${pc.iceConnectionState} for session ${session.clientId}`);
            let newStatus;
            const currentStatus = session.connectionStatus;
            switch (pc.iceConnectionState) {
                case "checking":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTING;
                    break;
                case "connected":
                case "completed":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTION_SUCCESSFUL;
                    session.pendingReplaceTrackActions.forEach(async (action) => {
                        await action();
                    });
                    session.pendingReplaceTrackActions = [];
                    // working around the fact that chrome does not go to completed for the
                    // ice-controlled answerer
                    if (
                        !session.wasEverConnected &&
                        (pc.iceConnectionState.match(/connected|completed/) ||
                            (browserName === "chrome" && pc.localDescription && pc.localDescription.type === "answer"))
                    ) {
                        session.wasEverConnected = true;
                    }

                    if (this._isAudioOnlyMode) {
                        session.setAudioOnly(true, this._screenshareVideoTrackIds);
                    }

                    session.registerConnected?.({});
                    break;
                case "disconnected":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTION_DISCONNECTED;
                    setTimeout(() => {
                        if (pc.iceConnectionState === "disconnected") {
                            this._maybeRestartIce(clientId, session);
                        }
                    }, ICE_RESTART_DELAY);
                    break;
                case "failed":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTION_FAILED;
                    if (currentStatus !== newStatus) {
                        this._maybeRestartIce(clientId, session);
                    }
                    if (!session.relayCandidateSeen && !session.wasEverConnected) {
                        // We did not gather any relay candidates and we were never connected.
                        // At that point we consider it a local network problem.
                        this.analytics.P2PLocalNetworkFailed++;
                        rtcStats.sendEvent("P2PLocalNetworkFailed", {
                            from: "iceConnectionStateChange",
                            clientId,
                        });
                        this._emit(rtcManagerEvents.CONNECTION_BLOCKED_BY_NETWORK);
                    }
                    break;
                default:
                    // other states are not interesting
                    return;
            }
            this._setConnectionStatus(session, newStatus, clientId);
        };

        pc.onconnectionstatechange = () => {
            logger.info(`connectionState changed to ${pc.connectionState} for session ${session.clientId}`);
            switch (pc.connectionState) {
                case "connected":
                    // try to detect audio problems.
                    // this waits 3 seconds after the connection is up
                    // to be sure the DTLS handshake is done even in Firefox.
                    setTimeout(() => {
                        webrtcBugDetector.detectMicrophoneNotWorking(session.pc).then((failureDirection) => {
                            if (failureDirection) {
                                this.analytics.P2PMicNotWorking++;
                                rtcStats.sendEvent("P2PMicNotWorking", { clientId, failureDirection });
                                // TODO: Decide if we want to act on this or not.

                                // this._emit(rtcManagerEvents.MICROPHONE_NOT_WORKING, {
                                //     failureDirection,
                                //     clientId,
                                // });
                            }
                        });
                    }, 3000);
                    session.registerConnected?.({});
                    break;
                case "failed":
                    const newStatus = CONNECTION_STATUS.TYPES.CONNECTION_FAILED;
                    // Chrome insists on not going to failed for unified-plan
                    // (new iceconnectionstate)... listen for connectionState.
                    // See also
                    //   https://bugs.chromium.org/p/chromium/issues/detail?id=933786
                    //   https://bugs.chromium.org/p/chromium/issues/detail?id=982793
                    if (!session.relayCandidateSeen && !session.wasEverConnected) {
                        // We did not gather any relay candidates and we were never connected.
                        // At that point we consider it a local network problem.
                        this.analytics.P2PLocalNetworkFailed++;
                        rtcStats.sendEvent("P2PLocalNetworkFailed", {
                            from: "connectionStateChange",
                            clientId,
                        });
                        this._emit(rtcManagerEvents.CONNECTION_BLOCKED_BY_NETWORK);
                    }
                    this._setConnectionStatus(session, newStatus, clientId);
                    break;
                case "closed":
                    this._cleanup(session.clientId);
                    break;
            }
        };

        // End of RTCPeerConnection event handlers.

        if (this._localCameraStream) {
            session.addStream(this._localCameraStream);
        }

        if (this._localScreenshareStream) {
            // if we are offering it's safe to add screensharing streams in initial offer
            if (isOfferer) {
                session.addStream(this._localScreenshareStream);
            } else {
                // if not we are here because of reconnecting, and will need to start screenshare
                // after connection is ready
                session.afterConnected.then(() => {
                    if (!this._localScreenshareStream) return;

                    this._emitServerEvent(PROTOCOL_REQUESTS.START_SCREENSHARE, {
                        receiverId: session.clientId,
                        streamId: this._localScreenshareStream.id,
                        hasAudioTrack: !!this._localScreenshareStream.getAudioTracks().length,
                    });
                    this._withForcedRenegotiation(session, () => {
                        if (this._localScreenshareStream) {
                            session.addStream(this._localScreenshareStream);
                        } else {
                            this.analytics.P2PStartScreenshareNoStream++;
                            rtcStats.sendEvent("P2PStartScreenshareNoStream", {});
                        }
                    });
                });
            }
        }

        if (this._features.increaseIncomingMediaBufferOn) {
            this._setJitterBufferTarget(pc);
        }

        /*
         * Explicitly add the video track so that stopOrResumeVideo() can
         * replace it when the video is re-enabled.
         */
        if (this._localCameraStream?.getVideoTracks()?.length && this._stoppedVideoTrack) {
            pc.addTrack(this._stoppedVideoTrack, this._localCameraStream);
        }

        return session;
    }

    _cleanup(clientId: string) {
        const session = this._getSession(clientId);
        if (!session) {
            logger.warn("No RTCPeerConnection in RTCManager.disconnect()", clientId);
            return;
        }
        session.close();
        delete this.peerConnections[clientId];
    }

    _forEachPeerConnection(func: any) {
        Object.values(this.peerConnections).forEach((peerConnection) => {
            func(peerConnection);
        });
    }

    _addStreamToPeerConnections(stream: MediaStream) {
        this._forEachPeerConnection((session: Session) => {
            this._withForcedRenegotiation(session, () => session.addStream(stream));
        });
    }

    _addTrackToPeerConnections(track: MediaStreamTrack, stream?: MediaStream) {
        this._forEachPeerConnection((session: Session) => {
            this._withForcedRenegotiation(session, () => session.addTrack(track, stream));
        });
    }

    _replaceTrackToPeerConnections(oldTrack: any, newTrack: any) {
        const promises: Promise<any>[] = [];
        this._forEachPeerConnection((session: Session) => {
            if (!session.hasConnectedPeerConnection()) {
                if (session.pc.connectionState === "closed") return;
                logger.info("Session doesn't have a connected PeerConnection, adding pending action!");
                const promise = new Promise((resolve, reject) => {
                    const action = async () => {
                        try {
                            await session.replaceTrack(oldTrack, newTrack);
                            resolve({});
                        } catch (error) {
                            reject(error);
                        }
                    };
                    session.pendingReplaceTrackActions.push(action);
                });
                promises.push(promise);
                return;
            }
            promises.push(session.replaceTrack(oldTrack, newTrack));
        });
        return Promise.all(promises).catch((error) => {
            logger.error(String(error));
        });
    }

    _removeStreamFromPeerConnections(stream: MediaStream) {
        this._forEachPeerConnection((session: Session) => {
            this._withForcedRenegotiation(session, () => session.removeStream(stream));
        });
    }

    _removeTrackFromPeerConnections(track: MediaStreamTrack) {
        this._forEachPeerConnection((session: Session) => {
            this._withForcedRenegotiation(session, () => session.removeTrack(track));
        });
    }

    _updateAndScheduleMediaServersRefresh({
        iceServers,
        turnServers,
        mediaserverConfigTtlSeconds,
    }: SignalMediaServerConfig) {
        this._iceServers = iceServers;
        this._turnServers = turnServers;
        this._mediaserverConfigTtlSeconds = mediaserverConfigTtlSeconds;

        this._clearMediaServersRefresh();
        if (!mediaserverConfigTtlSeconds) {
            return;
        }
        this._fetchMediaServersTimer = setTimeout(
            () => this._emitServerEvent(PROTOCOL_REQUESTS.FETCH_MEDIASERVER_CONFIG),
            mediaserverConfigTtlSeconds * 1000,
        );
    }

    _clearMediaServersRefresh() {
        if (!this._fetchMediaServersTimer) return;
        clearTimeout(this._fetchMediaServersTimer);
        this._fetchMediaServersTimer = null;
    }

    _monitorAudioTrack(track: MediaStreamTrack) {
        if (this._audioTrackBeingMonitored?.id === track.id) return;

        this._audioTrackBeingMonitored?.removeEventListener("ended", this._audioTrackOnEnded);
        track.addEventListener("ended", this._audioTrackOnEnded);
        this._audioTrackBeingMonitored = track;
    }

    _monitorVideoTrack(track: MediaStreamTrack) {
        if (this._videoTrackBeingMonitored?.id === track.id) return;

        this._videoTrackBeingMonitored?.removeEventListener("ended", this._videoTrackOnEnded);
        track.addEventListener("ended", this._videoTrackOnEnded);
        this._videoTrackBeingMonitored = track;
    }

    /**
     * This function should only be called as a response to READY_TO_RECEIVE_OFFER.
     * It is the starting point of our P2P negotiation and creates the initial offer.
     */
    _connect(clientId: string) {
        // bring rtcstats back up if disconnected
        try {
            this.rtcStatsReconnect();
        } catch (_) {}

        let session = this._getSession(clientId);
        let initialBandwidth = (session && session.bandwidth) || 0;
        if (session) {
            logger.warn("Replacing peer session", clientId);
            this._cleanup(clientId);
        } else {
            initialBandwidth = this._changeBandwidthForAllClients(true);
        }

        session = this._createSession({
            clientId,
            initialBandwidth,
            isOfferer: true,
        });
        this._negotiatePeerConnection({ clientId, session, isInitialOffer: true });
        return session;
    }

    _maybeRestartIce(clientId: string, session: Session) {
        const pc = session.pc;
        if (!(pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed")) {
            return;
        }

        // Only automatically try to restart if you sent the original offer
        if (pc.localDescription?.type === "offer") {
            // clean up some helpers.
            session.wasEverConnected = false;
            session.relayCandidateSeen = false;
            session.serverReflexiveCandidateSeen = false;
            session.publicHostCandidateSeen = false;
            session.ipv6HostCandidateSeen = false;
            session.ipv6HostCandidateTeredoSeen = false;
            session.ipv6HostCandidate6to4Seen = false;
            session.mdnsHostCandidateSeen = false;

            this.analytics.numIceRestart++;
            const constraints = { ...this.offerOptions, iceRestart: true };
            this._negotiatePeerConnection({ clientId, session, constraints });
        }
    }

    async _setCodecPreferences(pc: RTCPeerConnection) {
        const { p2pAv1On, redOn } = this._features;

        try {
            // audio
            const audioTransceivers = pc
                .getTransceivers()
                .filter((transceiver) => transceiver?.sender?.track?.kind === "audio");

            audioTransceivers.forEach((audioTransceiver) => {
                // If not implemented return
                if (typeof RTCRtpSender.getCapabilities === "undefined") return;
                const capabilities: any = RTCRtpSender.getCapabilities("audio");
                for (let i = 0; i < capabilities.codecs.length; i++) {
                    if (redOn && capabilities.codecs[i].mimeType.toLowerCase() === "audio/red") {
                        capabilities.codecs.unshift(capabilities.codecs.splice(i, 1)[0]);
                        break;
                    }
                }
                // If not implemented return
                if (typeof audioTransceiver.setCodecPreferences === "undefined") return;
                audioTransceiver.setCodecPreferences(capabilities.codecs);
            });
            // video
            const videoTransceivers = pc
                .getTransceivers()
                .filter((transceiver) => transceiver?.sender?.track?.kind === "video");

            await Promise.all(
                videoTransceivers.map(async (videoTransceiver) => {
                    // If not implemented return
                    if (RTCRtpReceiver.getCapabilities === undefined) return;
                    if (videoTransceiver.setCodecPreferences === undefined) return;

                    const capabilities: any = RTCRtpReceiver.getCapabilities("video");
                    capabilities.codecs = await sortCodecs(capabilities.codecs, {
                        av1On: p2pAv1On,
                    });

                    videoTransceiver.setCodecPreferences(capabilities.codecs);
                }),
            );
        } catch (error) {
            logger.error("Error during setting setCodecPreferences:", error);
        }
    }

    _negotiatePeerConnection({
        clientId,
        session,
        constraints,
        isInitialOffer = false,
    }: NegotiatePeerConnectionOptions) {
        if (!session) {
            logger.warn("No RTCPeerConnection in negotiatePeerConnection()", clientId);
            return;
        }
        const pc = session.pc;
        if (!session.canModifyPeerConnection()) {
            session.pending.push(() => {
                this._negotiatePeerConnection({ clientId, session, constraints, isInitialOffer });
            });
            return;
        }
        session.isOperationPending = true;

        const { redOn, rtpAbsCaptureTimeOn, cleanSdpOn } = this._features;

        this._setCodecPreferences(pc).then(() =>
            pc
                .createOffer(constraints || this.offerOptions)
                .then((offer) => {
                    if (!offer.sdp) {
                        this.analytics.P2PCreateOfferNoSDP++;
                        rtcStats.sendEvent("P2PCreateOfferNoSDP", {});
                        throw new Error("SDP undefined while creating offer");
                    }
                    // Add https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/abs-capture-time
                    if (rtpAbsCaptureTimeOn) offer.sdp = addAbsCaptureTimeExtMap(offer.sdp);
                    // SDP munging workaround for Firefox version < 128 where support for setCodecPreferences() was added.
                    if (browserName === "firefox" && browserVersion < 128) {
                        offer.sdp = setCodecPreferenceSDP({
                            sdp: offer.sdp as string,
                            redOn,
                            incrementAnalyticMetric: (metric: P2PAnalyticMetric) => this.analytics[metric]++,
                        });
                    }

                    // workaround for two different browser bugs:
                    // chrome can modify existing transceiver(m section) adding duplicate payload types
                    // firefox seems to sometime break sdp (maybe duplicate payload types here as well)
                    //  when running setCodecPreferences on existing tranceivers.
                    // (preventing setCodecPreferences on existing tranceivers, limiting to new only
                    // , might be a better fix for firefox, but does not apply to chrome)
                    if (cleanSdpOn) offer.sdp = cleanSdp(offer.sdp as string);

                    pc.setLocalDescription(offer)
                        .catch((e: any) => {
                            logger.warn("RTCPeerConnection.setLocalDescription() failed with local offer", e);
                            this.analytics.numPcSldFailure++;

                            throw e;
                        })
                        .then(() => {
                            const message = {
                                sdp: offer.sdp,
                                sdpU: offer.sdp,
                                type: offer.type,
                                isInitialOffer,
                            };
                            logger.info(`sending offer to client ${clientId}`);
                            this._emitServerEvent(RELAY_MESSAGES.SDP_OFFER, {
                                receiverId: clientId,
                                message,
                            });
                        });
                })
                .catch((e: any) => {
                    logger.warn("RTCPeerConnection.createOffer() failed to create local offer", e);
                }),
        );
    }

    _withForcedRenegotiation(session: Session, action: any) {
        const pc = session.pc;
        const originalOnnegotationneeded = pc.onnegotiationneeded;
        pc.onnegotiationneeded = null;
        action();
        this._negotiatePeerConnection({ clientId: session.clientId, session });
        setTimeout(() => (pc.onnegotiationneeded = originalOnnegotationneeded), 0);
    }

    // implements a strategy to change the bandwidth for all clients (without negotiation)
    // returns bandwidth so it can be used as initial bandwidth for new client.
    _changeBandwidthForAllClients(isJoining: boolean): number {
        let numPeers = this.numberOfPeerconnections();
        if (isJoining) {
            // client will be added to RTCManager.peerConnections afterwards
            numPeers += 1;
        }

        if (numPeers === 0) {
            return 0;
        }

        if (numPeers > 7) {
            // use last table value.
            numPeers = 7;
        }

        const bandwidth = this._features.bandwidth
            ? parseInt(this._features.bandwidth, 10)
            : {
                  1: 0,
                  2: 384,
                  3: 256,
                  4: 192,
                  5: 128,
                  6: 128,
                  7: 64,
              }[numPeers];

        if (bandwidth === undefined) {
            return 0;
        }

        this._forEachPeerConnection((session: Session) => {
            session.changeBandwidth(bandwidth);
        });

        return bandwidth;
    }

    /**
     * Possibly start a new peer connection for the new stream if needed.
     */
    acceptNewStream({ streamId, clientId }: { streamId: string; clientId: string }) {
        logger.info("acceptNewStream() [streamId: %s}, clientId: %s]", streamId, clientId);
        let session = this._getSession(clientId);
        if (session && streamId !== clientId) {
            // we are adding a screenshare stream to existing session/pc
            return session;
        }
        let initialBandwidth: number = (session && session.bandwidth) || 0;
        if (session) {
            // this will happen on a signal-server reconnect
            // before we tried an ice-restart here, now we recreate the session/pc
            this._cleanup(clientId); // will cleanup and delete session/pc
        } else {
            // we adjust bandwidth based on number of sessions/pcs
            // so only needed when streamId === clientId (camera) and we're not replacing beacuse of reconnect
            initialBandwidth = this._changeBandwidthForAllClients(true);
        }
        session = this._createSession({
            clientId,
            initialBandwidth,
            isOfferer: false,
        });
        this._emitServerEvent(RELAY_MESSAGES.READY_TO_RECEIVE_OFFER, {
            receiverId: clientId,
        });
        return session;
    }

    disconnect(clientId: string) {
        logger.info("disconnect() [clientId: %s]", clientId);
        this._cleanup(clientId);
        this._changeBandwidthForAllClients(false);
        const numPeers = this.numberOfPeerconnections();
        if (numPeers === 0) {
            this._rtcStatsDisconnectTimeout = setTimeout(() => {
                const numPeers = this.numberOfPeerconnections();
                if (numPeers === 0) {
                    this.rtcStatsDisconnect();
                }
            }, 60 * 1000);
        }
    }

    // this does not (currently) make sense for peer-to-peer connections
    updateStreamResolution(/* streamId, clientId, resolution */) {}

    stopOrResumeAudio(/*localStream, enable*/) {
        // detaches the audio from the peerconnection. No-op in P2P mode.
    }

    _handleStopOrResumeVideo({ enable, track }: { enable: boolean; track: MediaStreamTrack }) {
        if (!enable) {
            this._stoppedVideoTrack = track;
        } else {
            if (this._stoppedVideoTrack) {
                this._replaceTrackToPeerConnections(this._stoppedVideoTrack, track);
                delete this._stoppedVideoTrack;
            } else {
                this._addTrackToPeerConnections(track);
            }
        }
    }

    stopOrResumeVideo(localStream: MediaStream, enable: boolean) {
        logger.info("stopOrResumeVideo() [enable: %s]", enable);
        // actually turn off the camera. Chrome-only (Firefox has different plans)
        if (!["chrome", "safari"].includes(browserName)) {
            return;
        }

        if (this._stopCameraTimeout) {
            clearTimeout(this._stopCameraTimeout);
            this._stopCameraTimeout = null;
        }

        if (enable === false) {
            const stopCameraDelay =
                localStream.getVideoTracks().find((t) => !t.enabled)?.readyState === "ended" ? 0 : 5000;
            // try to stop the local camera so the camera light goes off.
            this._stopCameraTimeout = setTimeout(() => {
                localStream.getVideoTracks().forEach((track) => {
                    if (track.enabled === false) {
                        track.stop();
                        localStream.removeTrack(track);
                        this._emit(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_REMOVED as string, {
                            stream: localStream,
                            track,
                        });

                        this._handleStopOrResumeVideo({ enable, track });
                    }
                });
            }, stopCameraDelay);
        } else {
            if (localStream.getVideoTracks().length === 0) {
                // re-enable the stream
                const constraints = getConstraints(this._webrtcProvider.getMediaOptions()).video;
                if (!constraints) {
                    // user was screensharing with no-devices, the video
                    // device has been plugged out or similar
                    return;
                }
                navigator.mediaDevices
                    .getUserMedia({ video: constraints })
                    .then((stream) => {
                        const track = stream.getVideoTracks()[0];
                        localStream.addTrack(track);
                        this._monitorVideoTrack(track);
                        this._emit(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED as string, {
                            streamId: localStream.id,
                            tracks: [track],
                            screenShare: false,
                        });

                        this._handleStopOrResumeVideo({ enable, track });
                    })
                    .catch((e) => {
                        // we are seeing getUserMedia errors in sentry with no information, so if the value
                        // here isn't an error we create one so we can get a stack trace at least
                        if (!(e instanceof Error)) {
                            this.analytics.P2PNonErrorRejectionValueGUMError++;
                            e = new Error(`non-error gUM rejection value: ${JSON.stringify(e)}`);
                        }
                        throw e;
                    });
            }
        }
    }

    removeScreenshareStream(stream: MediaStream, { requestedByClientId }: RemoveScreenshareStreamOptions = {}) {
        logger.info(
            "removeScreenshareStream() [stream.id: %s, requestedByClientId: %s]",
            stream.id,
            requestedByClientId,
        );
        this._removeStreamFromPeerConnections(stream);
        this._emitServerEvent(PROTOCOL_REQUESTS.STOP_SCREENSHARE, { streamId: stream.id, requestedByClientId });
        delete this._localScreenshareStream;
    }

    hasClient(clientId: string) {
        return Object.keys(this.peerConnections).includes(clientId);
    }

    // In P2P, joining clients accept streams from existing clients.
    shouldAcceptStreamsFromBothSides() {
        return false;
    }
}
