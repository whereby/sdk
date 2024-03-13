import assert from "../utils/assert";
import rtcStats from "./rtcStatsService";
import Session from "./Session";
import ServerSocket from "../utils/ServerSocket";
import { MAXIMUM_TURN_BANDWIDTH, MAXIMUM_TURN_BANDWIDTH_UNLIMITED, MEDIA_JITTER_BUFFER_TARGET } from "./constants";
import * as webrtcBugDetector from "./bugDetector";
import { PROTOCOL_REQUESTS, RELAY_MESSAGES, PROTOCOL_RESPONSES } from "../model/protocol";
import * as CONNECTION_STATUS from "../model/connectionStatusConstants";
import RtcStream from "../model/RtcStream";
import { getOptimalBitrate } from "../utils/optimalBitrate";
import { setCodecPreferenceSDP, addAbsCaptureTimeExtMap } from "./sdpModifier";
import adapterRaw from "webrtc-adapter";
import ipRegex from "../utils/ipRegex";
import { Address6 } from "ip-address";
import checkIp from "check-ip";
import validate from "uuid-validate";
import rtcManagerEvents from "./rtcManagerEvents";
import Logger from "../utils/Logger";

const adapter = adapterRaw.default ?? adapterRaw;
const logger = new Logger();

const ICE_PUBLIC_IP_GATHERING_TIMEOUT = 3 * 1000;
const CAMERA_STREAM_ID = RtcStream.getCameraId();
const browserName = adapter.browserDetails.browser;
const browserVersion = adapter.browserDetails.version;

if (browserName === "firefox") {
    adapter.browserShim.shimGetDisplayMedia(window, "screen");
}

let unloading = false;
if (browserName === "chrome") {
    window.document.addEventListener("beforeunload", () => {
        unloading = true;
    });
}

export default class P2pRtcManager {
    constructor({ selfId, room, emitter, serverSocket, webrtcProvider, features }) {
        assert.ok(selfId, "selfId is required");
        assert.ok(room, "room is required");
        assert.ok(emitter && emitter.emit, "emitter is required");
        assert.ok(serverSocket instanceof ServerSocket, "serverSocket is required");
        assert.ok(webrtcProvider, "webrtcProvider is required");

        const { name, session, iceServers, sfuServer, mediaserverConfigTtlSeconds } = room;

        this._selfId = selfId;
        this._roomName = name;
        this._roomSessionId = session && session.id;
        this.peerConnections = {};
        this.localStreams = {};
        this.enabledLocalStreamIds = [];
        this._screenshareVideoTrackIds = [];
        this._socketListenerDeregisterFunctions = [];
        this._localStreamDeregisterFunction = null;
        this._emitter = emitter;
        this._serverSocket = serverSocket;
        this._webrtcProvider = webrtcProvider;
        this._features = features || {};
        this._isAudioOnlyMode = false;

        this.offerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
        this._pendingActionsForConnectedPeerConnections = [];

        this._audioTrackOnEnded = () => {
            // There are a couple of reasons the microphone could stop working.
            // One of them is getting unplugged. The other is the Chrome audio
            // process crashing. The third is the tab being closed.
            // https://bugs.chromium.org/p/chromium/issues/detail?id=1050008
            rtcStats.sendEvent("audio_ended", { unloading });
            this._emit(rtcManagerEvents.MICROPHONE_STOPPED_WORKING, {});
        };

        this._updateAndScheduleMediaServersRefresh({
            sfuServer,
            iceServers: iceServers.iceServers || [],
            mediaserverConfigTtlSeconds,
        });

        this.totalSessionsCreated = 0;
    }

    numberOfPeerconnections() {
        return Object.keys(this.peerConnections).length;
    }

    isInitializedWith({ selfId, roomName, isSfu }) {
        return this._selfId === selfId && this._roomName === roomName && isSfu === !!this._sfuServer;
    }

    supportsScreenShareAudio() {
        return true;
    }

    maybeRestrictRelayBandwidth(session) {
        session.maybeRestrictRelayBandwidth();
    }

    addNewStream(streamId, stream) {
        if (stream === this.localStreams[streamId]) {
            // this can happen after reconnect. We do not want to add the stream to the
            // peerconnection again.
            return;
        }

        this._addLocalStream(streamId, stream);

        if (streamId === CAMERA_STREAM_ID) {
            this._addStreamToPeerConnections(stream);
            const [audioTrack] = stream.getAudioTracks();
            if (audioTrack) {
                this._startMonitoringAudioTrack(audioTrack);
            }

            // This should not be needed, but checking nonetheless
            if (this._localStreamDeregisterFunction) {
                this._localStreamDeregisterFunction();
                this._localStreamDeregisterFunction = null;
            }

            const localStreamHandler = (e) => {
                const { enable, track } = e.detail;
                this._handleStopOrResumeVideo({ enable, track });
            };

            stream.addEventListener("stopresumevideo", localStreamHandler);
            this._localStreamDeregisterFunction = () => {
                stream.removeEventListener("stopresumevideo", localStreamHandler);
            };

            return;
        }

        // at this point it is clearly a screensharing stream.
        this._screenshareVideoTrackIds.push(stream.getVideoTracks()[0].id);
        this._shareScreen(streamId, stream);
        return;
    }

    replaceTrack(oldTrack, newTrack) {
        if (oldTrack && oldTrack.kind === "audio") {
            this._stopMonitoringAudioTrack(oldTrack);
        }
        if (newTrack && newTrack.kind === "audio") {
            this._startMonitoringAudioTrack(newTrack);
        }
        return this._replaceTrackToPeerConnections(oldTrack, newTrack);
    }

    accept({ clientId, shouldAddLocalVideo }) {
        return this.acceptNewStream({ streamId: clientId, clientId, shouldAddLocalVideo });
    }

    disconnectAll() {
        Object.keys(this.peerConnections).forEach((peerConnectionId) => {
            this.disconnect(peerConnectionId);
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
    }

    /* the Chrome audio process crashed (probably?)
     * try to fix it. Constraints are the audio device constraints
     * used in getUserMedia.
     */
    fixChromeAudio(constraints) {
        if (browserName !== "chrome") {
            return;
        }
        const localStream = this._getLocalCameraStream();
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack || audioTrack.readyState !== "ended") {
            return;
        }
        return navigator.mediaDevices.getUserMedia({ audio: constraints }).then((stream) => {
            const track = stream.getAudioTracks()[0];
            track.enabled = audioTrack.enabled; // retain mute state and don't accidentally unmute.
            localStream.removeTrack(audioTrack); // remove the old track.
            localStream.addTrack(track); // add the new track.
            return this.replaceTrack(audioTrack, track);
        });
    }

    setupSocketListeners() {
        this._socketListenerDeregisterFunctions = [
            () => this._clearMediaServersRefresh(),

            this._serverSocket.on(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, (data) => {
                if (data.error) {
                    logger.warn("FETCH_MEDIASERVER_CONFIG failed:", data.error);
                    return;
                }
                this._updateAndScheduleMediaServersRefresh(data);
            }),

            this._serverSocket.on(RELAY_MESSAGES.READY_TO_RECEIVE_OFFER, (data) => {
                this._connect(data.clientId);
            }),

            this._serverSocket.on(RELAY_MESSAGES.ICE_CANDIDATE, (data) => {
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on ICE_CANDIDATE", data);
                    return;
                }
                session.addIceCandidate(data.message);
            }),

            this._serverSocket.on(RELAY_MESSAGES.ICE_END_OF_CANDIDATES, (data) => {
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on ICE_END_OF_CANDIDATES", data);
                    return;
                }
                session.addIceCandidate(null);
            }),

            // when a new SDP offer is received from another client
            this._serverSocket.on(RELAY_MESSAGES.SDP_OFFER, (data) => {
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on SDP_OFFER", data);
                    return;
                }
                const offer = this._transformIncomingSdp(data.message, session.pc);
                session.handleOffer(offer).then((answer) => {
                    this._emitServerEvent(RELAY_MESSAGES.SDP_ANSWER, {
                        receiverId: data.clientId,
                        message: this._transformOutgoingSdp(answer),
                    });
                });
            }),

            // when a new SDP answer is received from another client
            this._serverSocket.on(RELAY_MESSAGES.SDP_ANSWER, (data) => {
                const session = this._getSession(data.clientId);
                if (!session) {
                    logger.warn("No RTCPeerConnection on SDP_ANSWER", data);
                    return;
                }
                const answer = this._transformIncomingSdp(data.message, session.pc);
                session.handleAnswer(answer);
            }),

            // if this is a reconnect to signal-server during screen-share we must let signal-server know
            this._serverSocket.on(PROTOCOL_RESPONSES.ROOM_JOINED, ({ room: { sfuServer: isSfu } }) => {
                if (isSfu || !this._wasScreenSharing) return;

                const screenShareStreamId = Object.keys(this.localStreams).find((id) => id !== CAMERA_STREAM_ID);
                if (!screenShareStreamId) {
                    return;
                }

                const screenshareStream = this.localStreams[screenShareStreamId];
                if (!screenshareStream) {
                    logger.warn("screenshare stream %s not found", screenShareStreamId);
                    return;
                }

                const hasAudioTrack = screenshareStream.getAudioTracks().length > 0;

                this._emitServerEvent(PROTOCOL_REQUESTS.START_SCREENSHARE, {
                    streamId: screenShareStreamId,
                    hasAudioTrack,
                });
            }),
        ];
    }

    sendAudioMutedStats(muted) {
        rtcStats.sendEvent("audio_muted", { muted });
    }

    sendVideoMutedStats(muted) {
        rtcStats.sendEvent("video_muted", { muted });
    }

    sendStatsCustomEvent(eventName, data) {
        rtcStats.sendEvent(eventName, data);
    }

    rtcStatsDisconnect() {
        rtcStats.server.close();
    }

    rtcStatsReconnect() {
        if (!rtcStats.server.connected) {
            rtcStats.server.connect();
        }
    }

    setAudioOnly(audioOnly) {
        this._isAudioOnlyMode = audioOnly;

        this._forEachPeerConnection((session) => {
            if (session.hasConnectedPeerConnection()) {
                this._withForcedRenegotiation(session, () =>
                    session.setAudioOnly(this._isAudioOnlyMode, this._screenshareVideoTrackIds)
                );
            }
        });
    }

    setRemoteScreenshareVideoTrackIds(remoteScreenshareVideoTrackIds = []) {
        const localScreenshareStream = this._getFirstLocalNonCameraStream();

        this._screenshareVideoTrackIds = [
            ...(localScreenshareStream?.track ? [localScreenshareStream.track.id] : []),
            ...remoteScreenshareVideoTrackIds,
        ];
    }

    setRoomSessionId(roomSessionId) {
        this._roomSessionId = roomSessionId;
    }

    _setConnectionStatus(session, newStatus, clientId) {
        const previousStatus = session.connectionStatus;
        if (previousStatus === newStatus) {
            return;
        }

        // prevent showing 'connecting' in the SFU case.
        if (session.peerConnectionId === this._selfId) {
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
    }

    _setJitterBufferTarget(pc) {
        try {
            const receivers = pc.getReceivers();

            receivers.forEach((receiver) => {
                receiver.jitterBufferTarget = MEDIA_JITTER_BUFFER_TARGET;
                // Legacy Chrome API
                receiver.playoutDelayHint = MEDIA_JITTER_BUFFER_TARGET / 1000; // seconds
            });
        } catch (error) {
            logger.error("Error during setting jitter buffer target:", error);
        }
    }

    _emitServerEvent(eventName, data, callback) {
        this._serverSocket.emit(eventName, data, callback);
    }

    _emit(eventName, data) {
        this._emitter.emit(eventName, data);
    }

    _addEnabledLocalStreamId(streamId) {
        this.enabledLocalStreamIds.push(streamId);
    }

    _deleteEnabledLocalStreamId(streamId) {
        const index = this.enabledLocalStreamIds.indexOf(streamId);
        if (index !== -1) {
            this.enabledLocalStreamIds.splice(index, 1);
        }
    }

    _getSession(peerConnectionId) {
        if (!(peerConnectionId in this.peerConnections)) {
            return null;
        }
        return this.peerConnections[peerConnectionId];
    }

    _getOrCreateSession(peerConnectionId, initialBandwidth) {
        let session = this.peerConnections[peerConnectionId];

        if (session === undefined) {
            // Some macs + ios devices have troubles using h264 encoder since safari 14
            // this will make them encode VP8 instead if available
            const deprioritizeH264Encoding =
                browserName === "safari" && browserVersion >= 14 && this._features.deprioritizeH264OnSafari;

            this.peerConnections[peerConnectionId] = session = new Session({
                peerConnectionId,
                bandwidth: initialBandwidth,
                maximumTurnBandwidth: this._features.unlimitedBandwidthWhenUsingRelayP2POn
                    ? MAXIMUM_TURN_BANDWIDTH_UNLIMITED
                    : MAXIMUM_TURN_BANDWIDTH,
                deprioritizeH264Encoding,
            });

            this.totalSessionsCreated++;
        }
        return session;
    }

    _getLocalCameraStream() {
        return this.localStreams[CAMERA_STREAM_ID];
    }

    _getNonLocalCameraStreamIds() {
        return Object.keys(this.localStreams).filter((streamId) => streamId !== CAMERA_STREAM_ID);
    }

    _isScreensharingLocally() {
        return this._getNonLocalCameraStreamIds().length > 0;
    }

    _getFirstLocalNonCameraStream() {
        const streamIds = this._getNonLocalCameraStreamIds();
        return streamIds.length === 0 ? null : this.localStreams[streamIds[0]];
    }

    _transformIncomingSdp(original) {
        return { type: original.type, sdp: original.sdpU };
    }

    _transformOutgoingSdp(original) {
        return { type: original.type, sdpU: original.sdp };
    }

    _createSession({ clientId, initialBandwidth, isOfferer, peerConnectionId, shouldAddLocalVideo }) {
        if (!peerConnectionId) {
            throw new Error("peerConnectionId is missing");
        }
        if (!clientId) {
            throw new Error("clientId is missing");
        }
        const session = this._getOrCreateSession(peerConnectionId, initialBandwidth);
        const constraints = { optional: [] };
        if (browserName === "chrome") {
            constraints.optional.push({
                googCpuOveruseDetection: true,
            });
        }

        // rtcstats integration
        constraints.optional.push({ rtcStatsRoomSessionId: this._roomSessionId });
        constraints.optional.push({ rtcStatsClientId: this._selfId });
        constraints.optional.push({ rtcStatsPeerId: peerConnectionId });
        constraints.optional.push({ rtcStatsConferenceId: this._roomName });

        const peerConnectionConfig = {
            iceServers: this._iceServers,
        };
        if (this._features.turnServerOverrideHost) {
            const host = this._features.turnServerOverrideHost;
            const port = host.indexOf(":") > 0 ? "" : ":443";
            const override = ":" + host + port;
            peerConnectionConfig.iceServers = peerConnectionConfig.iceServers.map((original) => {
                const entry = Object.assign({}, original);
                if (entry.url) {
                    entry.url = entry.url.replace(/:[^?]*/, override);
                }
                if (entry.urls) {
                    entry.urls = entry.urls.map((url) => url.replace(/:[^?]*/, override));
                }
                return entry;
            });
        }
        if (this._features.useOnlyTURN) {
            peerConnectionConfig.iceTransportPolicy = "relay";
            const filter = {
                onlyudp: /^turn:.*transport=udp$/,
                onlytcp: /^turn:.*transport=tcp$/,
                onlytls: /^turns:.*transport=tcp$/,
            }[this._features.useOnlyTURN];
            if (filter) {
                peerConnectionConfig.iceServers = peerConnectionConfig.iceServers.filter(
                    (entry) => entry.url && entry.url.match(filter)
                );
            }
        }

        if (browserName === "chrome") {
            peerConnectionConfig.sdpSemantics = "unified-plan";
        }

        const pc = session.setAndGetPeerConnection({
            constraints,
            peerConnectionConfig,
            shouldAddLocalVideo,
            clientId,
        });

        setTimeout(() => this._emit(rtcManagerEvents.NEW_PC), 0);

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (stream.id === "default" && stream.getAudioTracks().length === 0) {
                // due to our PlanB / UnifiedPlan conversion we can run into this:
                // https://bugs.chromium.org/p/webrtc/issues/detail?id=8228
                // and ignore it.
                return;
            }
            // ontrack fires for each track of a stream. Emulate old onaddstream behaviour.
            if (session.streamIds.indexOf(stream.id) === -1) {
                session.streamIds.push(stream.id);
                this._emit(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                    clientId,
                    stream,
                });

                // when adding a new stream to an already established connection
                // we need to tell the GUI about it.
                if (session.connectionStatus === CONNECTION_STATUS.TYPES.CONNECTION_SUCCESSFUL) {
                    setTimeout(() => {
                        this._emit(CONNECTION_STATUS.EVENTS.CLIENT_CONNECTION_STATUS_CHANGED, {
                            streamIds: session.streamIds,
                            clientId,
                            status: session.connectionStatus,
                            previous: CONNECTION_STATUS.TYPES.CONNECTING,
                        });
                    }, 0);
                }
            }
        };

        pc.oniceconnectionstatechange = () => {
            let newStatus;
            const currentStatus = session.connectionStatus;
            switch (pc.iceConnectionState) {
                case "checking":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTING;
                    break;
                case "connected":
                case "completed":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTION_SUCCESSFUL;
                    if (!session.wasEverConnected) {
                        this._pendingActionsForConnectedPeerConnections.forEach((action) => {
                            if (typeof action === "function") {
                                action();
                            }
                        });
                        this._pendingActionsForConnectedPeerConnections = [];
                    }
                    // working around the fact that chrome does not go to completed for the
                    // ice-controlled answerer
                    if (
                        !session.wasEverConnected &&
                        (pc.iceConnectionState.match(/connected|completed/) ||
                            (browserName === "chrome" && pc.localDescription && pc.localDescription.type === "answer"))
                    ) {
                        session.wasEverConnected = true;
                        if (this._features.bandwidth !== "false") {
                            this.maybeRestrictRelayBandwidth(session);
                        }
                    }

                    if (this._isAudioOnlyMode) {
                        session.setAudioOnly(true, this._screenshareVideoTrackIds);
                    }

                    session.registerConnected();
                    break;
                case "disconnected":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTION_DISCONNECTED;
                    setTimeout(() => {
                        if (pc.iceConnectionState === "disconnected") {
                            this._maybeRestartIce(clientId, session);
                        }
                    }, 2000);
                    break;
                case "failed":
                    newStatus = CONNECTION_STATUS.TYPES.CONNECTION_FAILED;
                    if (currentStatus !== newStatus) {
                        this._maybeRestartIce(clientId, session);
                    }
                    if (session.relayCandidateSeen === null && !session.wasEverConnected) {
                        // this means we did not gather any relay candidates.
                        // which shows that we are on a restricted network and it is an
                        // issue on the local end.
                        // Should not trigger if we  were ever connected.
                        this._emit(rtcManagerEvents.CONNECTION_BLOCKED_BY_NETWORK);
                    }
                    break;
                default:
                    // other states are not interesting
                    return;
            }
            this._setConnectionStatus(session, newStatus, clientId);
        };
        pc.onconnectionstate = () => {
            // since Chrome insists on not going to failed for unified-plan
            // (/new-iceconnectionstate)... listen for connectionState.
            // See also
            //   https://bugs.chromium.org/p/chromium/issues/detail?id=933786
            //   https://bugs.chromium.org/p/chromium/issues/detail?id=982793
            switch (pc.connectionState) {
                case "connected":
                    // try to detect audio problems.
                    // this waits 3 seconds after the connection is up
                    // to be sure the DTLS handshake is done even in Firefox.
                    setTimeout(() => {
                        webrtcBugDetector.detectMicrophoneNotWorking(session.pc).then((failureDirection) => {
                            if (failureDirection !== false) {
                                this._emit(rtcManagerEvents.MICROPHONE_NOT_WORKING, {
                                    failureDirection,
                                    clientId,
                                });
                            }
                        });
                    }, 3000);
                    session.registerConnected();
                    break;
                case "failed":
                    const newStatus = CONNECTION_STATUS.TYPES.CONNECTION_FAILED;
                    if (session.relayCandidateSeen === null && !session.wasEverConnected) {
                        // this means we did not gather any relay candidates.
                        // which shows that we are on a restricted network and it is an
                        // issue on the local end.
                        // Should not trigger if we  were ever connected.
                        this._emit(rtcManagerEvents.CONNECTION_BLOCKED_BY_NETWORK);
                    }
                    this._setConnectionStatus(session, newStatus, clientId);
                    break;
            }
        };

        const localCameraStream = this.localStreams[CAMERA_STREAM_ID];
        if (shouldAddLocalVideo && localCameraStream) {
            session.addStream(localCameraStream);
        }

        // Don't add existing screenshare-streams when using SFU as those will be
        // added in a separate session/peerConnection by SfuV2RtcManager
        if (shouldAddLocalVideo) {
            Object.keys(this.localStreams).forEach((id) => {
                if (id === CAMERA_STREAM_ID) {
                    return;
                }
                const screenshareStream = this.localStreams[id];
                // if we are offering it's safe to add screensharing streams in initial offer
                if (isOfferer) {
                    session.addStream(screenshareStream);
                } else {
                    // if not we are here because of reconnecting, and will need to start screenshare
                    // after connection is ready
                    session.afterConnected.then(() => {
                        this._emitServerEvent(PROTOCOL_REQUESTS.START_SCREENSHARE, {
                            receiverId: session.clientId,
                            streamId: screenshareStream.id,
                            hasAudioTrack: !!screenshareStream.getAudioTracks().length,
                        });
                        this._withForcedRenegotiation(session, () => session.addStream(screenshareStream));
                    });
                }
            });
        }

        return session;
    }

    _cleanup(peerConnectionId) {
        const session = this._getSession(peerConnectionId);
        if (!session) {
            logger.warn("No RTCPeerConnection in RTCManager.disconnect()", peerConnectionId);
            return;
        }
        session.close();
        delete this.peerConnections[peerConnectionId];
    }

    _forEachPeerConnection(func) {
        Object.values(this.peerConnections).forEach((peerConnection) => {
            func(peerConnection);
        });
    }

    _addStreamToPeerConnections(stream) {
        this._forEachPeerConnection((session) => {
            this._withForcedRenegotiation(session, () => session.addStream(stream));
        });
    }

    _addTrackToPeerConnections(track, stream) {
        this._forEachPeerConnection((session) => {
            this._withForcedRenegotiation(session, () => session.addTrack(track, stream));
        });
    }

    _replaceTrackToPeerConnections(oldTrack, newTrack) {
        const promises = [];
        this._forEachPeerConnection((session) => {
            if (!session.hasConnectedPeerConnection()) {
                logger.info("Session doesn't have a connected PeerConnection, adding pending action!");
                const pendingActions = this._pendingActionsForConnectedPeerConnections;
                if (!pendingActions) {
                    logger.warn(
                        `No pending action is created to repalce track, because the pending actions array is null`
                    );
                    return;
                }
                const promise = new Promise((resolve, reject) => {
                    const action = () => {
                        const replacedTrackPromise = session.replaceTrack(oldTrack, newTrack);
                        if (!replacedTrackPromise) {
                            logger.error("replaceTrack returned false!");
                            reject(`ReplaceTrack returned false`);
                            return;
                        }
                        replacedTrackPromise.then((track) => resolve(track)).catch((error) => reject(error));
                    };
                    pendingActions.push(action);
                });
                promises.push(promise);
                return;
            }
            const replacedTrackResult = session.replaceTrack(oldTrack, newTrack);
            if (!replacedTrackResult) {
                logger.error("replaceTrack returned false!");
                return;
            }
            promises.push(replacedTrackResult);
        });
        return Promise.all(promises);
    }

    _removeStreamFromPeerConnections(stream) {
        this._forEachPeerConnection((session) => {
            this._withForcedRenegotiation(session, () => session.removeStream(stream));
        });
    }

    _removeTrackFromPeerConnections(track) {
        this._forEachPeerConnection((session) => {
            this._withForcedRenegotiation(session, () => session.removeTrack(track));
        });
    }

    _addLocalStream(streamId, stream) {
        this._addEnabledLocalStreamId(streamId);
        this.localStreams[streamId] = stream;
    }

    _removeLocalStream(streamId) {
        delete this.localStreams[streamId];
        this._deleteEnabledLocalStreamId(streamId);
    }

    _updateAndScheduleMediaServersRefresh({ iceServers, sfuServer, mediaserverConfigTtlSeconds }) {
        this._iceServers = iceServers;
        this._sfuServer = sfuServer;
        this._mediaserverConfigTtlSeconds = mediaserverConfigTtlSeconds;

        this._clearMediaServersRefresh();
        if (!mediaserverConfigTtlSeconds) {
            return;
        }
        this._fetchMediaServersTimer = setTimeout(
            () => this._emitServerEvent(PROTOCOL_REQUESTS.FETCH_MEDIASERVER_CONFIG),
            mediaserverConfigTtlSeconds * 1000
        );
    }

    _clearMediaServersRefresh() {
        if (!this._fetchMediaServersTimer) return;
        clearTimeout(this._fetchMediaServersTimer);
        this._fetchMediaServersTimer = null;
    }

    _startMonitoringAudioTrack(track) {
        track.addEventListener("ended", this._audioTrackOnEnded);
    }

    _stopMonitoringAudioTrack(track) {
        track.removeEventListener("ended", this._audioTrackOnEnded);
    }
    _connect(clientId) {
        this.rtcStatsReconnect();
        const shouldAddLocalVideo = true;
        let session = this._getSession(clientId);
        let bandwidth = (session && session.bandwidth) || 0;
        if (session) {
            logger.warn("Replacing peer session", clientId);
            this._cleanup(clientId);
        } else {
            bandwidth = this._changeBandwidthForAllClients(true);
        }
        session = this._createP2pSession(clientId, bandwidth, shouldAddLocalVideo, true);
        this._negotiatePeerConnection(clientId, session);
        return Promise.resolve(session);
    }

    _maybeRestartIce(clientId, session) {
        const pc = session.pc;
        if (!(pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed")) {
            return;
        }

        // Only automatically try to restart if you sent the original offer
        if (pc.localDescription.type === "offer") {
            // clean up some helpers.
            session.wasEverConnected = false;
            session.relayCandidateSeen = false;
            session.serverReflexiveCandidateSeen = false;
            session.publicHostCandidateSeen = false;
            session.ipv6HostCandidateSeen = false;
            this.ipv6HostCandidateTeredoSeen = false;
            this.ipv6HostCandidate6to4Seen = false;
            this.mdnsHostCandidateSeen = false;

            this._emit(rtcManagerEvents.ICE_RESTART);

            this._negotiatePeerConnection(
                clientId,
                session,
                Object.assign({}, this.offerOptions, { iceRestart: true })
            );
        }
    }

    _setCodecPreferences(pc, vp9On, av1On, redOn) {
        try {
            // audio
            const audioTransceivers = pc
                .getTransceivers()
                .filter((transceiver) => transceiver?.sender?.track?.kind === "audio");

            audioTransceivers.forEach((audioTransceiver) => {
                // If not implemented return
                if (typeof RTCRtpSender.getCapabilities === "undefined") return;
                const capabilities = RTCRtpSender.getCapabilities("audio");
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

            videoTransceivers.forEach((videoTransceiver) => {
                // If not implemented return
                if (RTCRtpSender.getCapabilities === undefined) return;
                const capabilities = RTCRtpSender.getCapabilities("video");
                for (let i = 0; i < capabilities.codecs.length; i++) {
                    if (vp9On && capabilities.codecs[i].mimeType.toLowerCase() === "video/vp9") {
                        capabilities.codecs.unshift(capabilities.codecs.splice(i, 1)[0]);
                        break;
                    }
                    if (av1On && capabilities.codecs[i].mimeType.toLowerCase() === "video/av1") {
                        capabilities.codecs.unshift(capabilities.codecs.splice(i, 1)[0]);
                        break;
                    }
                }
                // If not implemented return
                if (videoTransceiver.setCodecPreferences === undefined) return;
                videoTransceiver.setCodecPreferences(capabilities.codecs);
            });
        } catch (error) {
            logger.error("Error during setting setCodecPreferences:", error);
        }
    }

    _negotiatePeerConnection(clientId, session, constraints) {
        if (!session) {
            logger.warn("No RTCPeerConnection in negotiatePeerConnection()", clientId);
            return;
        }
        const pc = session.pc;
        if (!session.canModifyPeerConnection()) {
            session.pending.push(() => {
                this._negotiatePeerConnection(clientId, session, constraints);
            });
            return;
        }
        session.isOperationPending = true;

        const { vp9On, av1On, redOn, rtpAbsCaptureTimeOn } = this._features;

        // Set codec preferences to video transceivers
        if (vp9On || av1On || redOn) {
            this._setCodecPreferences(pc, vp9On, av1On, redOn);
        }
        pc.createOffer(constraints || this.offerOptions)
            .then((offer) => {
                // Add https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/abs-capture-time
                if (rtpAbsCaptureTimeOn) offer.sdp = addAbsCaptureTimeExtMap(offer.sdp);
                // SDP munging workaround for Firefox, because it doesn't support setCodecPreferences()
                // Only vp9 because FF does not support AV1 yet
                if ((vp9On || redOn) && browserName === "firefox") {
                    offer.sdp = setCodecPreferenceSDP(offer.sdp, vp9On, redOn);
                }

                this._emitServerEvent(RELAY_MESSAGES.SDP_OFFER, {
                    receiverId: clientId,
                    message: this._transformOutgoingSdp(offer),
                });

                // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394602
                // make Chrome send media later when there are two (more more?) video tracks.
                if (
                    browserName === "chrome" &&
                    pc.getSenders().filter((sender) => sender.track && sender.track.kind === "video").length >= 2
                ) {
                    session.pendingOffer = offer;
                    return;
                }
                pc.setLocalDescription(offer).catch((e) => {
                    logger.warn("RTCPeerConnection.setLocalDescription() failed with local offer", e);

                    // we failed to create a valid offer so try having the other side create it, without looping
                    if (this._features.reverseOfferOnFailure) {
                        if (!this._lastReverseDirectionAttemptByClientId)
                            this._lastReverseDirectionAttemptByClientId = {};
                        if (
                            !this._lastReverseDirectionAttemptByClientId[clientId] ||
                            this._lastReverseDirectionAttemptByClientId[clientId] < Date.now() - 10000
                        ) {
                            this.acceptNewStream({ clientId, streamId: clientId, shouldAddLocalVideo: true });
                            this._lastReverseDirectionAttemptByClientId[clientId] = Date.now();
                        }
                    }
                });
            })
            .catch((e) => {
                logger.warn("RTCPeerConnection.createOffer() failed to create local offer", e);
            });
    }

    _withForcedRenegotiation(session, action) {
        const pc = session.pc;
        const originalOnnegotationneeded = pc.onnegotationneeded;
        pc.onnegotiationneeded = null;
        action();
        this._negotiatePeerConnection(session.clientId, session);
        setTimeout(() => (pc.onnegotiationneeded = originalOnnegotationneeded), 0);
    }

    // implements a strategy to change the bandwidth for all clients (without negotiation)
    // returns bandwidth so it can be used as initial bandwidth for new client.
    _changeBandwidthForAllClients(isJoining) {
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

        // We use a slightly different curve in premium to give better quality when
        // there are few participants.
        let bandwidth = this._features.bandwidth
            ? parseInt(this._features.bandwidth, 10)
            : {
                  1: 0,
                  2: this._features.highP2PBandwidth ? 768 : 384,
                  3: this._features.highP2PBandwidth ? 512 : 256,
                  4: 192,
                  5: 128,
                  6: 128,
                  7: 64,
              }[numPeers];

        if (bandwidth === undefined) {
            return 0;
        }

        if (this._features.adjustBitratesFromResolution) {
            const cameraStream = this._getLocalCameraStream();
            if (cameraStream) {
                const cameraTrack = cameraStream && cameraStream.getVideoTracks()[0];
                if (cameraTrack) {
                    const { width, height, frameRate } = cameraTrack.getSettings();
                    if (width && height && frameRate) {
                        const optimalBandwidth = Math.round(getOptimalBitrate(width, height, frameRate) / 1000);
                        bandwidth = Math.min(optimalBandwidth, bandwidth || optimalBandwidth);
                    }
                }
            }
        }

        if (this._features.higherP2PBitrates) {
            bandwidth = bandwidth * 1.5;
        }

        this._forEachPeerConnection((session) => {
            session.changeBandwidth(bandwidth);
        });

        return bandwidth;
    }

    _createP2pSession(clientId, initialBandwidth, shouldAddLocalVideo, isOfferer) {
        const session = this._createSession({
            peerConnectionId: clientId,
            clientId,
            initialBandwidth,
            shouldAddLocalVideo,
            isOfferer,
        });
        const pc = session.pc;

        if (this._features.increaseIncomingMediaBufferOn) {
            this._setJitterBufferTarget(pc);
        }

        /*
         * Explicitly add the video track so that stopOrResumeVideo() can
         * replace it when the video is re-enabled.
         */
        const localCameraStream = this.localStreams[CAMERA_STREAM_ID];
        if (
            shouldAddLocalVideo &&
            localCameraStream &&
            !localCameraStream.getVideoTracks().length &&
            this._stoppedVideoTrack
        ) {
            pc.addTrack(this._stoppedVideoTrack, localCameraStream);
        }

        pc.onicegatheringstatechange = (event) => {
            const connection = event.target;

            switch (connection.iceGatheringState) {
                case "gathering":
                    if (this.icePublicIPGatheringTimeoutID) clearTimeout(this.icePublicIPGatheringTimeoutID);
                    this.icePublicIPGatheringTimeoutID = setTimeout(() => {
                        if (
                            !session.publicHostCandidateSeen &&
                            !session.relayCandidateSeen &&
                            !session.serverReflexiveCandidateSeen
                        ) {
                            this._emit(rtcManagerEvents.ICE_NO_PUBLIC_IP_GATHERED_3SEC);
                        }
                    }, ICE_PUBLIC_IP_GATHERING_TIMEOUT);
                    break;
                case "complete":
                    if (this.icePublicIPGatheringTimeoutID) clearTimeout(this.icePublicIPGatheringTimeoutID);
                    this.icePublicIPGatheringTimeoutID = undefined;
                    break;
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                switch (event.candidate?.type) {
                    case "host":
                        const address = event?.candidate?.address;
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
                        if (!session.serverReflexiveCandidateSeen) {
                            session.serverReflexiveCandidateSeen = true;
                        }
                        break;
                    case "relay":
                    case "relayed":
                        if (!session.relayCandidateSeen) {
                            session.relayCandidateSeen = true;
                        }
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
                    !session.serverReflexiveCandidateSeen
                ) {
                    this._emit(rtcManagerEvents.ICE_NO_PUBLIC_IP_GATHERED);
                }
                if (session.ipv6HostCandidateSeen) {
                    this._emit(rtcManagerEvents.ICE_IPV6_SEEN, {
                        teredoSeen: session.ipv6HostCandidateTeredoSeen,
                        sixtofourSeen: session.ipv6HostCandidate6to4Seen,
                    });
                }
                if (session.mdnsHostCandidateSeen) this._emit(rtcManagerEvents.ICE_MDNS_SEEN);
            }
        };

        pc.onnegotiationneeded = () => {
            if (pc.iceConnectionState === "new" || !session.connectionStatus) {
                // initial negotiation is handled by our CLIENT_READY/READY_TO_RECEIVE_OFFER exchange
                return;
            }
            this._negotiatePeerConnection(clientId, session);
        };
        return session;
    }

    /**
     * Possibly start a new peer connection for the new stream if needed.
     */
    acceptNewStream({ streamId, clientId, shouldAddLocalVideo }) {
        let session = this._getSession(clientId);
        if (session && streamId !== clientId) {
            // we are adding a screenshare stream to existing session/pc
            return session;
        }
        let bandwidth = (session && session.bandwidth) || 0;
        if (session) {
            // this will happen on a signal-server reconnect
            // before we tried an ice-restart here, now we recreate the session/pc
            logger.warn("Replacing peer session", clientId);
            this._cleanup(clientId); // will cleanup and delete session/pc
        } else {
            // we adjust bandwidth based on number of sessions/pcs
            // so only needed when streamId === clientId (camera) and we're not replacing beacuse of reconnect
            bandwidth = this._changeBandwidthForAllClients(true);
        }
        session = this._createP2pSession(clientId, bandwidth, shouldAddLocalVideo);
        this._emitServerEvent(RELAY_MESSAGES.READY_TO_RECEIVE_OFFER, {
            receiverId: clientId,
        });
        return session;
    }

    disconnect(clientId) {
        this._cleanup(clientId);
        this._changeBandwidthForAllClients(false);
        const numPeers = this.numberOfPeerconnections();
        if (numPeers === 0) {
            setTimeout(() => {
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

    _handleStopOrResumeVideo({ enable, track }) {
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

    stopOrResumeVideo(localStream, enable) {
        // actually turn off the camera. Chrome-only (Firefox has different plans)
        if (!["chrome", "safari"].includes(browserName)) {
            return;
        }
        if (enable === false) {
            // try to stop the local camera so the camera light goes off.
            setTimeout(() => {
                localStream.getVideoTracks().forEach((track) => {
                    if (track.enabled === false) {
                        track.stop();
                        localStream.removeTrack(track);
                        this._emit(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_REMOVED, {
                            stream: localStream,
                            track,
                        });

                        this._handleStopOrResumeVideo({ enable, track });
                    }
                });
            }, 5000);
        } else {
            if (localStream.getVideoTracks().length === 0) {
                // re-enable the stream
                const constraints = this._webrtcProvider.getMediaConstraints().video;
                if (!constraints) {
                    // user was screensharing with no-devices, the video
                    // device has been plugged out or similar
                    return;
                }
                navigator.mediaDevices.getUserMedia({ video: constraints }).then((stream) => {
                    const track = stream.getVideoTracks()[0];
                    localStream.addTrack(track);
                    this._emit(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                        streamId: localStream.id,
                        tracks: [track],
                        screenShare: false,
                    });

                    this._handleStopOrResumeVideo({ enable, track });
                });
            }
        }
    }

    _shareScreen(streamId, stream) {
        this._emitServerEvent(PROTOCOL_REQUESTS.START_SCREENSHARE, {
            streamId,
            hasAudioTrack: !!stream.getAudioTracks().length,
        });
        this._wasScreenSharing = true;
        this._addStreamToPeerConnections(stream);
    }

    removeStream(streamId, stream, requestedByClientId) {
        this._removeLocalStream(streamId, stream);
        this._removeStreamFromPeerConnections(stream);
        this._wasScreenSharing = false;
        this._emitServerEvent(PROTOCOL_REQUESTS.STOP_SCREENSHARE, { streamId, requestedByClientId });
    }

    hasClient(clientId) {
        return Object.keys(this.peerConnections).includes(clientId);
    }
}
