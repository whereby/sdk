import { Device } from "mediasoup-client";
import adapterRaw from "webrtc-adapter";
import { v4 as uuidv4 } from "uuid";
// of the provided ones, this seems to work best in NodeJS
import { Safari12 as NodeDeviceHandler } from "mediasoup-client/lib/handlers/Safari12.js";

import rtcManagerEvents from "../rtcManagerEvents";
import rtcStats from "../rtcStatsService";
import VegaConnection from "../VegaConnection";
import createMicAnalyser from "../VegaMicAnalyser";
import { CustomMediaStreamTrack, RtcManager } from "../types";
import VegaMediaQualityMonitor from "../VegaMediaQualityMonitor";
import { MEDIA_JITTER_BUFFER_TARGET } from "../constants";

import { PROTOCOL_EVENTS, PROTOCOL_REQUESTS, PROTOCOL_RESPONSES } from "../../model/protocol";
import * as CONNECTION_STATUS from "../../model/connectionStatusConstants";
import { getMediaSettings, modifyMediaCapabilities } from "../../utils/mediaSettings";
import { getMediasoupDeviceAsync } from "../../utils/getMediasoupDevice";
import { maybeTurnOnly, turnServerOverride } from "../../utils/iceServers";
import Logger from "../../utils/Logger";
import { addProducerCpuOveruseWatch, getLayers, getNumberOfActiveVideos, getNumberOfTemporalLayers } from "./utils";
import { ServerSocket } from "../../utils";
import { createVegaConnectionManager, HostListEntryOptionalDC } from "../VegaConnectionManager";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;
const logger = new Logger();

const browserName = adapter.browserDetails.browser;
let unloading = false;

const RESTARTICE_ERROR_RETRY_THRESHOLD_IN_MS = 3500;
const RESTARTICE_ERROR_MAX_RETRY_COUNT = 5;
const OUTBOUND_CAM_OUTBOUND_STREAM_ID = uuidv4();
const OUTBOUND_SCREEN_OUTBOUND_STREAM_ID = uuidv4();

if (browserName === "chrome") window.document.addEventListener("beforeunload", () => (unloading = true));

type MediaSteamWhichMayHaveInboundId = MediaStream & { inboundId?: string };

type ClientState = {
    hasAcceptedWebcamStream: Boolean;
    hasAcceptedScreenStream: Boolean;
    hasEmittedWebcamStream: Boolean;
    hasEmittedScreenStream: Boolean;
    webcamStream?: MediaSteamWhichMayHaveInboundId;
    screenStream?: MediaSteamWhichMayHaveInboundId;
    screenShareStreamId?: string;
    camStreamId?: string;
};

export default class VegaRtcManager implements RtcManager {
    _selfId: any;
    _room: any;
    _roomSessionId: any;
    _emitter: any;
    _serverSocket: ServerSocket;
    _webrtcProvider: any;
    _features: any;
    _eventClaim?: any;
    _vegaConnection: any;
    _micAnalyser: any;
    _micAnalyserDebugger: any;
    _mediasoupDeviceInitializedAsync: Promise<Device | null>;
    _routerRtpCapabilities: RtpCapabilities | null;
    _sendTransport: any;
    _receiveTransport: any;
    _clientStates: Map<string, ClientState>;
    _streamIdToVideoConsumerId: any;
    _streamIdToVideoResolution: Map<string, { width: number; height: number }>;
    _consumers: any;
    _dataConsumers: any;
    _localStreamDeregisterFunction: any;
    _micTrack: any;
    _webcamTrack: any;
    _screenVideoTrack: any;
    _screenAudioTrack: any;
    _micProducer: any;
    _micProducerPromise: any;
    _micPaused: any;
    _micScoreProducer: any;
    _micScoreProducerPromise: any;
    _webcamProducer: any;
    _webcamProducerPromise: any;
    _webcamPaused: any;
    _screenVideoProducer: any;
    _screenVideoProducerPromise: any;
    _screenAudioProducer: any;
    _screenAudioProducerPromise: any;
    _sndTransportIceRestartPromise: any;
    _rcvTransportIceRestartPromise: any;
    _colocation: any;
    _stopCameraTimeout: any;
    _audioTrackOnEnded: any;
    _videoTrackOnEnded: any;
    _socketListenerDeregisterFunctions: any;
    _reconnect: any;
    _reconnectTimeOut: any;
    _qualityMonitor: any;
    _fetchMediaServersTimer: any;
    _iceServers: any;
    _turnServers: any;
    _sfuServer: any;
    _sfuServers?: HostListEntryOptionalDC[];
    _mediaserverConfigTtlSeconds: any;
    _videoTrackBeingMonitored?: CustomMediaStreamTrack;
    _audioTrackBeingMonitored?: CustomMediaStreamTrack;
    _isConnectingOrConnected: boolean;
    _vegaConnectionManager?: ReturnType<typeof createVegaConnectionManager>;
    _networkIsDetectedUpBySignal: boolean;
    _cpuOveruseDetected: boolean;

    constructor({
        selfId,
        room,
        emitter,
        serverSocket,
        webrtcProvider,
        features,
        eventClaim,
    }: {
        selfId: any;
        room: any;
        emitter: any;
        serverSocket: any;
        webrtcProvider: any;
        features?: any;
        eventClaim?: string;
    }) {
        const { session, iceServers, turnServers, sfuServer, sfuServers, mediaserverConfigTtlSeconds } = room;

        this._selfId = selfId;
        this._room = room;
        this._roomSessionId = session?.id;
        this._emitter = emitter;
        this._serverSocket = serverSocket;
        this._webrtcProvider = webrtcProvider;
        this._features = features || {};
        this._eventClaim = eventClaim;

        this._vegaConnection = null;

        this._micAnalyser = null;
        this._micAnalyserDebugger = null;

        this._mediasoupDeviceInitializedAsync = getMediasoupDeviceAsync(features);

        this._routerRtpCapabilities = null;

        this._sendTransport = null;
        this._receiveTransport = null;

        // Mapped by clientId
        this._clientStates = new Map();

        // Used for setting preferred layers based on streamId
        this._streamIdToVideoConsumerId = new Map();
        this._streamIdToVideoResolution = new Map();

        // All consumers we have from the SFU
        this._consumers = new Map();
        this._dataConsumers = new Map();

        // Function to clean up event listeners on the local stream
        this._localStreamDeregisterFunction = null;

        this._micTrack = null;
        this._webcamTrack = null;
        this._screenVideoTrack = null;
        this._screenAudioTrack = null;

        this._micProducer = null;
        this._micProducerPromise = null;
        this._micPaused = false;
        this._micScoreProducer = null;
        this._micScoreProducerPromise = null;
        this._webcamProducer = null;
        this._webcamProducerPromise = null;
        this._webcamPaused = false;
        this._screenVideoProducer = null;
        this._screenVideoProducerPromise = null;
        this._screenAudioProducer = null;
        this._screenAudioProducerPromise = null;

        this._sndTransportIceRestartPromise = null;
        this._rcvTransportIceRestartPromise = null;

        this._colocation = null;

        this._stopCameraTimeout = null;
        this._audioTrackOnEnded = () => {
            // There are a couple of reasons the microphone could stop working.
            // One of them is getting unplugged. The other is the Chrome audio
            // process crashing. The third is the tab being closed.
            // https://bugs.chromium.org/p/chromium/issues/detail?id=1050008
            rtcStats.sendEvent("audio_ended", { unloading });
            this._emitToPWA(rtcManagerEvents.MICROPHONE_STOPPED_WORKING, {});
        };
        this._videoTrackOnEnded = () => {
            rtcStats.sendEvent("video_ended", { unloading });
            this._emitToPWA(rtcManagerEvents.CAMERA_STOPPED_WORKING, {});
        };

        this._updateAndScheduleMediaServersRefresh({
            sfuServer,
            sfuServers,
            iceServers: iceServers?.iceServers || [],
            turnServers: turnServers || [],
            mediaserverConfigTtlSeconds,
        });

        this._socketListenerDeregisterFunctions = [];

        // Retry if connection closed until disconnectAll called;
        this._reconnect = true;
        this._reconnectTimeOut = null;
        this._isConnectingOrConnected = false;

        this._qualityMonitor = new VegaMediaQualityMonitor();
        this._qualityMonitor.on(PROTOCOL_EVENTS.MEDIA_QUALITY_CHANGED, (payload: any) => {
            this._emitToPWA(PROTOCOL_EVENTS.MEDIA_QUALITY_CHANGED, payload);
        });

        this._networkIsDetectedUpBySignal = false;
        this._cpuOveruseDetected = false;
    }

    _updateAndScheduleMediaServersRefresh({
        iceServers,
        turnServers,
        sfuServer,
        sfuServers,
        mediaserverConfigTtlSeconds,
    }: {
        iceServers: any;
        turnServers: any;
        sfuServer: any;
        sfuServers: any;
        mediaserverConfigTtlSeconds: any;
    }) {
        this._iceServers = iceServers;
        this._turnServers = turnServers;
        this._sfuServer = sfuServer;
        this._sfuServers = sfuServers;

        // support packing list of sfuServers inside existing sfuServer prop
        if (!sfuServers && sfuServer?.fallbackServers) {
            this._sfuServers = sfuServer.fallbackServers.map((entry: any) => ({
                host: entry.host || entry.fqdn,
                dc: entry.dc,
            }));
        }

        this._mediaserverConfigTtlSeconds = mediaserverConfigTtlSeconds;

        // update vega connection manager if exists
        this._vegaConnectionManager?.updateHostList(
            this._features.sfuServersOverride ||
                this._sfuServers ||
                this._features.sfuServerOverrideHost ||
                sfuServer.url,
        );

        const iceServersList = {
            iceServers: this._features.turnServersOn ? this._turnServers : this._iceServers,
        };

        iceServersList.iceServers = turnServerOverride(
            iceServersList.iceServers,
            this._features.turnServerOverrideHost,
        );

        this._sendTransport?.updateIceServers(iceServersList);
        this._receiveTransport?.updateIceServers(iceServersList);

        this._clearMediaServersRefresh();
        if (!mediaserverConfigTtlSeconds) {
            return;
        }
        this._fetchMediaServersTimer = setTimeout(
            () => this._emitToSignal(PROTOCOL_REQUESTS.FETCH_MEDIASERVER_CONFIG),
            mediaserverConfigTtlSeconds * 1000,
        );
    }

    _clearMediaServersRefresh() {
        if (!this._fetchMediaServersTimer) return;
        clearTimeout(this._fetchMediaServersTimer);
        this._fetchMediaServersTimer = null;
    }

    _onNetworkIsDetectedUpBySignal() {
        if (!this._networkIsDetectedUpBySignal) {
            this._networkIsDetectedUpBySignal = true;
            this._vegaConnectionManager?.networkIsUp();
        }
    }

    _onNetworkIsDetectedPossiblyDownBySignal() {
        if (this._networkIsDetectedUpBySignal) {
            this._networkIsDetectedUpBySignal = false;
            this._vegaConnectionManager?.networkIsPossiblyDown();
        }
    }

    setupSocketListeners() {
        this._socketListenerDeregisterFunctions.push(
            () => this._clearMediaServersRefresh(),

            this._serverSocket.on(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, (data: any) => {
                if (data.error) {
                    logger.warn("FETCH_MEDIASERVER_CONFIG failed:", data.error);
                    return;
                }
                this._updateAndScheduleMediaServersRefresh(data);
            }),
            this._serverSocket.on(PROTOCOL_RESPONSES.ROOM_JOINED, (payload: any) => {
                if (payload?.error) {
                    return;
                }

                if (this._screenVideoTrack) this._emitScreenshareStarted();
                if (this._reconnect) {
                    this._connect();
                }
            }),

            // use signal server to learn if network is up or possibly down
            this._serverSocket.on("connect", () => this._onNetworkIsDetectedUpBySignal()),
            this._serverSocket.onEngineEvent("packet", () => this._onNetworkIsDetectedUpBySignal()),
            this._serverSocket.on("disconnect", () => this._onNetworkIsDetectedPossiblyDownBySignal()),
        );

        this._connect();
    }

    _emitScreenshareStarted() {
        this._emitToSignal(PROTOCOL_REQUESTS.START_SCREENSHARE, {
            streamId: OUTBOUND_SCREEN_OUTBOUND_STREAM_ID,
            hasAudioTrack: Boolean(this._screenAudioTrack),
        });
    }

    _connect() {
        if (this._isConnectingOrConnected) return;

        if (!this._serverSocket.isConnected()) {
            // Consider reconnecting to SFU within glitchfree reconnect threshold.
            const reconnectThresholdInMs = this._serverSocket.getReconnectThreshold();
            if (!reconnectThresholdInMs) return; // We're not using ReconnectManager and glitchfree reconnect.

            // We don't have signal-server connection and it's too late to do glitchfree reconnect.
            if (Date.now() > (this._serverSocket.disconnectTimestamp || 0) + reconnectThresholdInMs) return;
        }

        // This SFU connect attempt could have been triggered by a room_joined response from signal-server.
        // If so, a reconnect might also have been scheduled, and we need to cancel it to avoid a loop.
        if (this._reconnectTimeOut) clearTimeout(this._reconnectTimeOut);

        if (!this._vegaConnectionManager) {
            const hostList =
                this._features.sfuServersOverride ||
                this._sfuServers ||
                this._features.sfuServerOverrideHost ||
                this._sfuServer.url;

            this._vegaConnectionManager = createVegaConnectionManager({
                initialHostList: hostList,
                getUrlForHost: (host) => {
                    const searchParams = new URLSearchParams({
                        clientId: this._selfId,
                        organizationId: this._room.organizationId,
                        roomName: this._room.name,
                        eventClaim: this._room.isClaimed ? this._eventClaim : null,
                        lowBw: "true",
                        ...Object.keys(this._features || {})
                            .filter((featureKey) => this._features[featureKey] && /^sfu/.test(featureKey))
                            .reduce((prev, current) => ({ ...prev, [current]: this._features[current] }), {}),
                    });
                    const queryString = searchParams.toString();
                    const wsUrl = `wss://${host}?${queryString}`;
                    return wsUrl;
                },
                onConnected: (vegaConnection, info) => {
                    this._vegaConnection = vegaConnection;
                    this._vegaConnection.on("message", (message: any) => this._onMessage(message));
                    this._emitToPWA(rtcManagerEvents.SFU_CONNECTION_INFO, info);
                    this._join();
                },
                onDisconnected: () => {
                    this._vegaConnection = null;
                    this._isConnectingOrConnected = false;
                    this._onClose();
                },
                onFailed: () => {
                    this._vegaConnection = null;
                    this._isConnectingOrConnected = false;
                    this._onClose();
                },
            });
        }
        this._vegaConnectionManager.connect();
        this._isConnectingOrConnected = true;
    }

    _onClose() {
        logger.info("_onClose()");

        // These will clean up any and all producers/consumers
        this._sendTransport?.close();
        this._receiveTransport?.close();
        this._sendTransport = null;
        this._receiveTransport = null;

        // Clear all mappings we have
        this._streamIdToVideoConsumerId.clear();
        this._streamIdToVideoResolution.clear();

        if (this._reconnect) {
            this._reconnectTimeOut = setTimeout(() => this._connect(), 1000);
        }

        this._qualityMonitor.close();
        this._emitToPWA(rtcManagerEvents.SFU_CONNECTION_CLOSED);
    }

    async _join() {
        logger.info("join()");
        this._emitToPWA(rtcManagerEvents.SFU_CONNECTION_OPEN);

        try {
            // We need to always do this, as this triggers the join logic on the SFU
            const { routerRtpCapabilities } = await this._vegaConnection.request("getCapabilities");

            if (!this._routerRtpCapabilities) {
                const modifiedCapabilities = modifyMediaCapabilities(routerRtpCapabilities, {
                    ...this._features,
                    vp9On: this._features.sfuVp9On,
                });

                this._routerRtpCapabilities = modifiedCapabilities;
                await (
                    await this._mediasoupDeviceInitializedAsync
                )?.load({ routerRtpCapabilities: modifiedCapabilities });
            }

            this._vegaConnection.message("setCapabilities", {
                rtpCapabilities: (await this._mediasoupDeviceInitializedAsync)?.rtpCapabilities,
            });

            if (this._colocation) this._vegaConnection.message("setColocation", { colocation: this._colocation });

            await Promise.all([this._createTransport(true), this._createTransport(false)]);

            const mediaPromises = [];

            if (this._micTrack && !this._micProducer && !this._micProducerPromise)
                mediaPromises.push(this._internalSendMic());
            if (this._webcamTrack && !this._webcamProducer && !this._webcamProducerPromise)
                mediaPromises.push(this._internalSendWebcam());
            if (this._screenVideoTrack && !this._screenVideoProducer && !this._screenVideoProducerPromise)
                mediaPromises.push(this._internalSendScreenVideo());
            if (this._screenAudioTrack && !this._screenAudioProducer && !this._screenAudioProducerPromise)
                mediaPromises.push(this._internalSendScreenAudio());

            await Promise.all(mediaPromises);
        } catch (error) {
            logger.error("_join() [error:%o]", error);
            // TODO: handle this error, rejoin?
        }
    }

    async _createTransport(send: any) {
        const creator = send ? "createSendTransport" : "createRecvTransport";

        const transportOptions = await this._vegaConnection.request("createTransport", {
            producing: send,
            consuming: !send,
            enableTcp: true,
            enableUdp: true,
            preferUdp: true,
            sctpParameters: {
                enableSctp: true,
                numSctpStreams: {
                    OS: 1024,
                    MIS: 1024,
                },
                maxSctpMessageSize: 262144,
                sctpSendBufferSize: 262144,
            },
        });

        transportOptions.iceServers = turnServerOverride(
            this._features.turnServersOn ? this._turnServers : this._iceServers,
            this._features.turnServerOverrideHost,
        );

        maybeTurnOnly(transportOptions, this._features);

        const transport = (await this._mediasoupDeviceInitializedAsync)?.[creator](transportOptions);
        const onConnectionStateListener = async (connectionState: any) => {
            logger.info(`Transport ConnectionStateChanged ${connectionState}`);
            if (connectionState !== "disconnected" && connectionState !== "failed") {
                return;
            }
            if (send) {
                if (this._sndTransportIceRestartPromise) {
                    return;
                }
                this._sndTransportIceRestartPromise = this._restartIce(transport).finally(() => {
                    this._sndTransportIceRestartPromise = null;
                });
            } else {
                if (this._rcvTransportIceRestartPromise) {
                    return;
                }
                this._rcvTransportIceRestartPromise = this._restartIce(transport).finally(() => {
                    this._rcvTransportIceRestartPromise = null;
                });
            }
        };
        transport
            ?.on("connect", ({ dtlsParameters }: { dtlsParameters: any }, callback: any) => {
                this._vegaConnection?.message("connectTransport", {
                    transportId: transport.id,
                    dtlsParameters,
                });

                callback();
            })
            .on("connectionstatechange", onConnectionStateListener);

        transport?.observer.once("close", () => {
            transport.removeListener("connectionstatechange", onConnectionStateListener);
        });

        if (send) {
            transport?.on(
                "produce",
                async (
                    {
                        kind,
                        rtpParameters,
                        appData,
                    }: {
                        kind: any;
                        rtpParameters: any;
                        appData: any;
                    },
                    callback: any,
                    errback: any,
                ) => {
                    try {
                        const { paused } = appData;

                        const { id } = await this._vegaConnection?.request("produce", {
                            transportId: transport.id,
                            kind,
                            rtpParameters,
                            paused,
                            appData,
                        });

                        callback({ id });
                    } catch (error) {
                        errback(error);
                    }
                },
            );
            transport?.on(
                "producedata",
                async (
                    {
                        appData,
                        sctpStreamParameters,
                    }: {
                        appData: any;
                        sctpStreamParameters: any;
                    },
                    callback: any,
                    errback: any,
                ) => {
                    try {
                        const { id } = await this._vegaConnection?.request("produceData", {
                            transportId: transport.id,
                            sctpStreamParameters,
                            appData,
                        });
                        callback({ id });
                    } catch (error) {
                        errback(error);
                    }
                },
            );

            this._sendTransport = transport;
        } else {
            this._receiveTransport = transport;
        }
    }

    async _restartIce(transport: any, retried = 0) {
        if (!transport || !("closed" in transport) || !("connectionState" in transport)) {
            logger.info("_restartIce: No transport or property closed or connectionState!");
            return;
        }

        if (transport.closed) {
            logger.info("_restartIce: Transport is closed!");
            return;
        }

        if (transport.connectionState !== "disconnected" && transport.connectionState !== "failed") {
            logger.info("_restartIce: Connection is healthy ICE restart no loneger needed!");
            return;
        }

        // Prevent too fast iceRestarts
        const { iceRestartStarted } = transport.appData;
        const now = Date.now();
        if (Number.isFinite(iceRestartStarted) && now - iceRestartStarted < RESTARTICE_ERROR_RETRY_THRESHOLD_IN_MS) {
            return;
        }
        transport.appData.iceRestartStarted = now;

        if (RESTARTICE_ERROR_MAX_RETRY_COUNT <= retried) {
            logger.info("_restartIce: Reached restart ICE  maximum retry count!");
            return;
        }

        if (!this._vegaConnection) {
            logger.info(`_restartIce: Connection is undefined`);
            return;
        }
        const { iceParameters } = await this._vegaConnection.request("restartIce", { transportId: transport.id });

        logger.info("_restartIce: ICE restart iceParameters received from SFU: ", iceParameters);
        const error = await transport
            .restartIce({ iceParameters })
            .then(() => null)
            .catch((err: any) => err);

        if (error) {
            logger.error(`_restartIce: ICE restart failed: ${error}`);
            switch (error.message) {
                case "missing transportId":
                case "no such transport":
                    // no retry
                    break;
                default:
                    // exponential backoff
                    await new Promise((resolve) => {
                        setTimeout(
                            () => {
                                resolve(undefined);
                            },
                            Math.min(RESTARTICE_ERROR_RETRY_THRESHOLD_IN_MS * 2 ** retried, 60000),
                        );
                    });
                    await this._restartIce(transport, retried + 1);
                    break;
            }
            return;
        }
        await new Promise((resolve) => {
            setTimeout(
                () => {
                    resolve(undefined);
                },
                60000 * Math.min(8, retried + 1),
            );
        });
        if (transport.connectionState === "failed" || transport.connectionState === "disconnected") {
            await this._restartIce(transport, retried + 1);
            return;
        }
    }

    async _internalSendMic() {
        logger.info("_internalSendMic()");

        this._micProducerPromise = (async () => {
            try {
                // Have any of our resources disappeared while we were waiting to be executed?
                if (!this._micTrack || !this._sendTransport || this._micProducer) {
                    this._micProducerPromise = null;
                    return;
                }

                const currentPaused = this._micPaused;

                const producer = await this._sendTransport.produce({
                    track: this._micTrack,
                    disableTrackOnPause: false,
                    stopTracks: false,
                    ...getMediaSettings("audio", false, { ...this._features, vp9On: this._features.sfuVp9On }),
                    appData: {
                        streamId: OUTBOUND_CAM_OUTBOUND_STREAM_ID,
                        sourceClientId: this._selfId,
                        screenShare: false,
                        source: "mic",
                        paused: currentPaused,
                    },
                });

                currentPaused ? producer.pause() : producer.resume();

                this._micProducer = producer;
                this._qualityMonitor.addProducer(this._selfId, producer.id);

                producer.observer.once("close", () => {
                    logger.info('micProducer "close" event');

                    if (producer.appData.localClosed)
                        this._vegaConnection?.message("closeProducers", { producerIds: [producer.id] });

                    this._micProducer = null;
                    this._micProducerPromise = null;
                    this._qualityMonitor.removeProducer(this._selfId, producer.id);
                });

                if (this._micTrack !== this._micProducer.track) await this._replaceMicTrack();
                if (this._micPaused !== this._micProducer.paused) this._pauseResumeMic();
            } catch (error) {
                logger.error("micProducer failed:%o", error);
            } finally {
                this._micProducerPromise = null;

                // Has the track disappeared while we were waiting to be executed?
                if (!this._micTrack) {
                    this._stopProducer(this._micProducer);
                    this._micProducer = null;
                }
            }
        })();
    }

    async _internalSetupMicScore() {
        logger.info("_internalSetupMicScore()");

        this._micScoreProducerPromise = (async () => {
            try {
                // Have any of our resources disappeared while we were waiting to be executed?
                if (!this._micProducer || !this._colocation || this._micScoreProducer) {
                    this._micScoreProducerPromise = null;
                    return;
                }

                const producer = await this._sendTransport.produceData({
                    ordered: false,
                    maxPacketLifeTime: 3000,
                    label: "micscore",
                    appData: {
                        producerId: this._micProducer.id,
                        clientId: this._selfId,
                    },
                });

                this._micScoreProducer = producer;

                producer.observer.once("close", () => {
                    logger.info('micScoreProducer "close" event');
                    if (producer.appData.localClosed) {
                        this._vegaConnection?.message("closeDataProducers", { dataProducerIds: [producer.id] });
                    }

                    this._micScoreProducer = null;
                    this._micScoreProducerPromise = null;
                });
            } catch (error) {
                logger.error("micScoreProducer failed:%o", error);
            } finally {
                this._micScoreProducerPromise = null;

                // Has the mic producer disappeared or colocation turned off while we were waiting?
                if (!this._micProducer || !this._colocation) {
                    this._stopMicScoreProducer();
                }
            }
        })();
    }

    _stopMicScoreProducer() {
        this._stopProducer(this._micScoreProducer);
        this._micScoreProducer = null;
    }

    async _replaceMicTrack() {
        logger.info("_replaceMicTrack()");

        if (!this._micTrack || !this._micProducer || this._micProducer.closed) return;

        if (this._micProducer.track !== this._micTrack) {
            await this._micProducer.replaceTrack({ track: this._micTrack });
            this._micAnalyser?.setTrack(this._micTrack);

            // Recursively call replaceMicTrack() until the new track is used.
            // This is needed because someone could have called sendXXX() while we
            // were waiting for the new track to be used.
            await this._replaceMicTrack();
        }
    }

    _pauseResumeMic() {
        logger.info("_pauseResumeMic()");

        if (!this._micProducer || this._micProducer.closed) return;

        if (this._micPaused !== this._micProducer.paused) {
            if (this._micPaused) {
                this._micProducer.pause();

                this._vegaConnection?.message("pauseProducers", {
                    producerIds: [this._micProducer.id],
                });
            } else {
                this._micProducer.resume();

                this._vegaConnection?.message("resumeProducers", {
                    producerIds: [this._micProducer.id],
                });
            }

            // Recursively call pauseResumeMic() until the new paused state is used.
            // This is needed because someone could have called sendXXX() while we
            // were waiting for the new paused state to be used.
            this._pauseResumeMic();
        }
    }

    async _sendMic(track: MediaStreamTrack) {
        logger.info("_sendMic() [track:%o]", track);

        this._micTrack = track;

        if (this._micProducer) {
            return await this._replaceMicTrack();
        } else if (this._micProducerPromise) {
            // This promise will make sure to call replaceMicTrack() once the
            // previous _sendMic() promise is resolved, so we can simply return.
            return;
        }

        // We don't do anything if we don't have a sendTransport yet.
        // The join logic will call _internalSendMic() again once the sendTransport is ready.
        if (this._sendTransport) return await this._internalSendMic();
    }

    _sendMicScore(score: number) {
        // drop invalid scores
        if (isNaN(score)) return;
        if (!isFinite(score)) return;

        if (this._micScoreProducer) {
            // bug in mediasoup? seems once("close") is not always fired, so we need another check here
            if (this._micScoreProducer.closed) {
                this._stopMicScoreProducer();
                return;
            }

            try {
                this._micScoreProducer.send(JSON.stringify({ score }));
            } catch (ex) {
                logger.error("_sendMicScore failed [error:%o]", ex);
            }
            return;
        }
        // create producer on first non-zero score when it doesn't exist
        // it needs the _micProducer.id. we don't care about dropping a few intial scores while this is set up
        if (!this._micScoreProducerPromise && this._micProducer && this._colocation && score !== 0) {
            this._internalSetupMicScore();
        }
    }

    // sets/updates appropriate resource usage
    _syncResourceUsage() {
        if (this._webcamProducer) {
            // control simulcast layer 3 activation
            const simulcastLayer3ShouldBeActive = !this._cpuOveruseDetected;

            const params = this._webcamProducer.rtpParameters;

            // only do this when we are using 3 layer simulcast
            if (params?.encodings?.length === 3) {
                // only update if needed, in case of unwanted side effects
                const targetMaxSpatialLayer = simulcastLayer3ShouldBeActive ? 2 : 1;
                if (this._webcamProducer.maxSpatialLayer !== targetMaxSpatialLayer) {
                    this._webcamProducer.setMaxSpatialLayer(targetMaxSpatialLayer);
                    rtcStats.sendEvent("simulcast_layer_activation_changed", {
                        layerIndex: 2,
                        active: simulcastLayer3ShouldBeActive,
                    });
                }
            }
        }
    }

    async _internalSendWebcam() {
        logger.info("_internalSendWebcam()");
        if (
            !this._sendTransport ||
            this._webcamProducer ||
            this._webcamProducerPromise ||
            this._webcamTrack?.readyState !== "live"
        ) {
            return;
        }

        this._webcamProducerPromise = (async () => {
            try {
                const currentPaused = this._webcamPaused;

                const producer = await this._sendTransport.produce({
                    track: this._webcamTrack,
                    disableTrackOnPause: false,
                    stopTracks: false,
                    ...getMediaSettings("video", false, { ...this._features, vp9On: this._features.sfuVp9On }),
                    appData: {
                        streamId: OUTBOUND_CAM_OUTBOUND_STREAM_ID,
                        sourceClientId: this._selfId,
                        screenShare: false,
                        source: "webcam",
                        paused: currentPaused,
                    },
                });

                currentPaused ? producer.pause() : producer.resume();

                // this adds the cpu watch (detection) if feature is enabled.
                const cleanUpCpuWatch = this._features.producerCpuOveruseWatchOn
                    ? addProducerCpuOveruseWatch({
                          producer,
                          onOveruse: () => {
                              rtcStats.sendEvent("producer_cpuoveruse_detected", {});

                              // we stop monitoring once we detect
                              cleanUpCpuWatch();

                              // mark cpu overuse and sync to apply changes if needed
                              this._cpuOveruseDetected = true;
                              this._syncResourceUsage();
                          },
                      })
                    : () => {};

                this._webcamProducer = producer;
                this._qualityMonitor.addProducer(this._selfId, producer.id);
                producer.observer.once("close", () => {
                    logger.info('webcamProducer "close" event');

                    if (producer.appData.localClosed)
                        this._vegaConnection?.message("closeProducers", { producerIds: [producer.id] });

                    cleanUpCpuWatch();

                    this._webcamProducer = null;
                    this._webcamProducerPromise = null;
                    this._qualityMonitor.removeProducer(this._selfId, producer.id);
                });

                // Has someone replaced the track?
                if (this._webcamTrack && this._webcamTrack !== this._webcamProducer?.track) {
                    this._webcamProducerPromise = null;
                    this._replaceWebcamTrack();
                }
                if (this._webcamPaused !== this._webcamProducer.paused) this._pauseResumeWebcam();
            } catch (error) {
                logger.error("webcamProducer failed:%o", error);
            } finally {
                this._webcamProducerPromise = null;

                // Has the track disappeared while we were waiting to be executed?
                if (!this._webcamTrack) {
                    this._stopProducer(this._webcamProducer);
                    this._webcamProducer = null;
                }
            }
        })();
    }

    async _replaceWebcamTrack() {
        logger.info("_replaceWebcamTrack()");
        if (!this._sendTransport || !this._webcamTrack || this._webcamProducerPromise) return;

        // if we attempted to produce an ended track earlier no producer would have been made
        // so here, later, it will be replaced with a working track, and the producer needs to be created
        if (!this._webcamProducer && this._webcamTrack.enabled) {
            await this._internalSendWebcam();
            return;
        }

        if (this._webcamProducer.track !== this._webcamTrack) {
            await this._webcamProducer.replaceTrack({ track: this._webcamTrack });
            await this._replaceWebcamTrack();
        }
    }

    _pauseResumeWebcam() {
        logger.info("_pauseResumeWebcam()");

        if (!this._webcamProducer || this._webcamProducer.closed) return;

        if (this._webcamPaused !== this._webcamProducer.paused) {
            if (this._webcamPaused) {
                this._webcamProducer.pause();

                this._vegaConnection?.message("pauseProducers", {
                    producerIds: [this._webcamProducer.id],
                });
            } else {
                this._webcamProducer.resume();

                this._vegaConnection?.message("resumeProducers", {
                    producerIds: [this._webcamProducer.id],
                });
            }

            this._pauseResumeWebcam();
        }
    }

    async _sendWebcam(track: MediaStreamTrack) {
        logger.info("_sendWebcam() [track:%o]", track);

        this._webcamTrack = track;

        if (this._webcamProducer) {
            return await this._replaceWebcamTrack();
        } else if (this._webcamProducerPromise) {
            return;
        }

        if (this._sendTransport) return await this._internalSendWebcam();
    }

    async _internalSendScreenVideo() {
        logger.info("_internalSendScreenVideo()");

        this._screenVideoProducerPromise = (async () => {
            try {
                // Have any of our resources disappeared while we were waiting to be executed?
                if (!this._screenVideoTrack || !this._sendTransport || this._screenVideoProducer) {
                    this._screenVideoProducerPromise = null;
                    return;
                }

                // VP9 + SVC isn't supported for screenshares, so we force VP8
                const codec = this._features.sfuVp9On
                    ? this._routerRtpCapabilities?.codecs?.find((codec) => codec.mimeType.match(/vp8/i))
                    : undefined;

                const producer = await this._sendTransport.produce({
                    track: this._screenVideoTrack,
                    disableTrackOnPause: false,
                    stopTracks: false,
                    codec,
                    ...getMediaSettings(
                        "video",
                        true,
                        // Screenshare doesn't support SVC encoding, so we force VP8
                        { ...this._features, vp9On: false },
                        this._getAreTooManyAlreadyPresenting(),
                    ),
                    appData: {
                        streamId: OUTBOUND_SCREEN_OUTBOUND_STREAM_ID,
                        sourceClientId: this._selfId,
                        screenShare: true,
                        source: "screenvideo",
                        paused: false,
                    },
                });

                this._screenVideoProducer = producer;
                this._qualityMonitor.addProducer(this._selfId, producer.id);
                producer.observer.once("close", () => {
                    logger.info('screenVideoProducer "close" event');

                    if (producer.appData.localClosed)
                        this._vegaConnection?.message("closeProducers", { producerIds: [producer.id] });

                    this._screenVideoProducer = null;
                    this._screenVideoProducerPromise = null;
                    this._qualityMonitor.removeProducer(this._selfId, producer.id);
                });

                // Has someone replaced the track?
                if (this._screenVideoTrack !== this._screenVideoProducer.track) await this._replaceScreenVideoTrack();
            } catch (error) {
                logger.error("screenVideoProducer failed:%o", error);
            } finally {
                this._screenVideoProducerPromise = null;

                // Has the track disappeared while we were waiting to be executed?
                if (!this._screenVideoTrack) {
                    await this._stopProducer(this._screenVideoProducer);
                    this._screenVideoProducer = null;
                }
            }
        })();
    }

    async _replaceScreenVideoTrack() {
        logger.info("_replaceScreenVideoTrack()");

        if (!this._screenVideoTrack || !this._screenVideoProducer || this._screenVideoProducer.closed) return;

        if (this._screenVideoProducer.track !== this._screenVideoTrack) {
            await this._screenVideoProducer.replaceTrack({ track: this._screenVideoTrack });
            await this._replaceScreenVideoTrack();
        }
    }

    async _sendScreenVideo(track: MediaStreamTrack) {
        logger.info("_sendScreenVideo() [track:%o]", track);

        this._screenVideoTrack = track;

        if (this._screenVideoProducer) {
            return await this._replaceScreenVideoTrack();
        } else if (this._screenVideoProducerPromise) {
            return;
        }

        if (this._sendTransport) return await this._internalSendScreenVideo();
    }

    async _internalSendScreenAudio() {
        logger.info("_internalSendScreenAudio()");

        this._screenAudioProducerPromise = (async () => {
            try {
                // Have any of our resources disappeared while we were waiting to be executed?
                if (!this._screenAudioTrack || !this._sendTransport || this._screenAudioProducer) {
                    this._screenAudioProducerPromise = null;
                    return;
                }

                const producer = await this._sendTransport.produce({
                    track: this._screenAudioTrack,
                    disableTrackOnPause: false,
                    stopTracks: false,
                    ...getMediaSettings("audio", true, { ...this._features, vp9On: this._features.sfuVp9On }),
                    appData: {
                        streamId: OUTBOUND_SCREEN_OUTBOUND_STREAM_ID,
                        sourceClientId: this._selfId,
                        screenShare: true,
                        source: "screenaudio",
                        paused: false,
                    },
                });

                this._screenAudioProducer = producer;
                this._qualityMonitor.addProducer(this._selfId, producer.id);
                producer.observer.once("close", () => {
                    logger.info('screenAudioProducer "close" event');

                    if (producer.appData.localClosed)
                        this._vegaConnection?.message("closeProducers", { producerIds: [producer.id] });

                    this._screenAudioProducer = null;
                    this._screenAudioProducerPromise = null;
                    this._qualityMonitor.removeProducer(this._selfId, producer.id);
                });

                // Has someone replaced the track?
                if (this._screenAudioTrack !== this._screenAudioProducer.track) await this._replaceScreenAudioTrack();
            } catch (error) {
                logger.error("screenAudioProducer failed:%o", error);
            } finally {
                this._screenAudioProducerPromise = null;

                // Has the track disappeared while we were waiting to be executed?
                if (!this._screenAudioTrack) {
                    await this._stopProducer(this._screenAudioProducer);
                    this._screenAudioProducer = null;
                }
            }
        })();
    }

    async _replaceScreenAudioTrack() {
        logger.info("_replaceScreenAudioTrack()");

        if (!this._screenAudioTrack || !this._screenAudioProducer || this._screenAudioProducer.closed) return;

        if (this._screenAudioProducer.track !== this._screenAudioTrack) {
            await this._screenAudioProducer.replaceTrack({ track: this._screenAudioTrack });
            await this._replaceScreenAudioTrack();
        }
    }

    async _sendScreenAudio(track: MediaStreamTrack) {
        logger.info("_sendScreenAudio() [track:%o]", track);

        this._screenAudioTrack = track;

        if (this._screenAudioProducer) {
            return await this._replaceScreenAudioTrack();
        } else if (this._screenAudioProducerPromise) {
            return;
        }

        if (this._sendTransport) return await this._internalSendScreenAudio();
    }

    _stopProducer(producer: any) {
        logger.info("_stopProducer()");

        if (!producer || producer.closed) return;

        producer.appData.localClosed = true;
        producer.close();
    }

    _getAreTooManyAlreadyPresenting() {
        return (
            [...this._clientStates.values()].filter((state) => state.hasAcceptedScreenStream && state.screenStream)
                .length >= 3
        );
    }

    /**
     * This is called from the RTCDispatcher when the signal socket reconnects to
     * verify that the RTCManager is still valid.
     *
     * @param {{
     *     selfId: string,
     *     roomName: string,
     *     isSfu: boolean,
     * }} options
     * @returns {boolean}
     */
    isInitializedWith({ selfId, roomName, isSfu }: { selfId: string; roomName: string; isSfu: boolean }) {
        return this._selfId === selfId && this._room.name === roomName && Boolean(isSfu);
    }

    /**
     * This gets called from the RTCDispatcher when the signal socket reconnects.
     *
     * @param {string} eventClaim
     */
    setEventClaim(eventClaim: string) {
        this._eventClaim = eventClaim;

        this._vegaConnection?.message("eventClaim", { eventClaim });
    }

    /**
     * This gets called when the user joins a colocation group, where the group is
     * the string identified for the group that is shared between the users.
     *
     * @param {string} colocation
     */
    setColocation(colocation: any) {
        this._colocation = colocation;
        this._vegaConnection?.message("setColocation", { colocation });

        // stop mic score producer when leaving colocation
        // (it will start on demand when score is attempted sent and mic track is ready)
        if (!colocation && this._micScoreProducer && !this._micScoreProducerPromise) {
            this._stopMicScoreProducer();
        }

        this._syncMicAnalyser();

        rtcStats.sendEvent("colocation_changed", { colocation });
    }

    /**
     * This sends a signal to the SFU to pause all incoming video streams to the client.
     *
     * @param {boolean} audioOnly
     */
    setAudioOnly(audioOnly: boolean) {
        this._vegaConnection?.message(audioOnly ? "enableAudioOnly" : "disableAudioOnly");
    }

    // the track ids send by signal server for remote-initiated screenshares
    setRemoteScreenshareVideoTrackIds(/*remoteScreenshareVideoTrackIds*/) {}

    /**
     * The unique identifier for this room session.
     *
     * @param {string} roomSessionId
     */
    setRoomSessionId(roomSessionId: string) {
        this._roomSessionId = roomSessionId;
    }

    /**
     * The first parameter is either a clientId if the client actually leaves
     * or a streamId if the client stops its screen share. The eventClaim must
     * be sent to the SFU to ensure that the SFU knows that the client has left.
     *
     * @param {string} clientIdOrStreamId
     * @param {ignored} _activeBreakout
     * @param {string} eventClaim
     */
    disconnect(clientIdOrStreamId: string, _activeBreakout: any, eventClaim?: string) {
        logger.info("disconnect() [clientIdOrStreamId:%s, eventClaim:%s]", clientIdOrStreamId, eventClaim);

        const clientState = this._clientStates.get(clientIdOrStreamId);
        if (clientState) {
            // In this case this is a disconnect from an actual client, not just a screen share.

            clientState.hasAcceptedWebcamStream = false;
            clientState.hasAcceptedScreenStream = false;

            this._syncIncomingStreamsWithPWA(clientIdOrStreamId);
        }

        if (eventClaim) {
            this._eventClaim = eventClaim;
            this._vegaConnection?.message("eventClaim", { eventClaim });
        }
    }

    /**
     * Only used for webcam/mic stream.
     *
     * We can ignore the oldTrack and match based on kind instead.
     *
     * This is called when the PWA does a internal track replacement because of
     * ex. effects added and so on.
     *
     * @param {MediaStreamTrack | null} _oldTrack
     * @param {MediaStreamTrack} track
     */
    replaceTrack(oldTrack: CustomMediaStreamTrack | null, track: CustomMediaStreamTrack) {
        if (track.kind === "audio") {
            if (!track.effectTrack) {
                this._monitorAudioTrack(track);
            }
            this._micTrack = track;
            this._replaceMicTrack();
        }

        if (track.kind === "video") {
            if (!track.effectTrack) {
                this._monitorVideoTrack(track);
            }
            this._webcamTrack = track;
            this._replaceWebcamTrack();
        }
    }

    /**
     * Only used for screen sharing.
     *
     * This is called when the user stops sharing their screen, and it can
     * be requested from a remote client.
     *
     * @param {string} streamId
     * @param {MediaStream} _stream
     * @param {string} requestedByClientId
     */
    removeStream(streamId: string, _stream: MediaStream, requestedByClientId: string) {
        logger.info("removeStream() [streamId:%s, requestedByClientId:%s]", streamId, requestedByClientId);

        this._emitToSignal(PROTOCOL_REQUESTS.STOP_SCREENSHARE, {
            streamId: OUTBOUND_SCREEN_OUTBOUND_STREAM_ID,
            requestedByClientId,
        });

        this._stopProducer(this._screenVideoProducer);
        this._screenVideoProducer = null;
        this._screenVideoTrack = null;
        this._stopProducer(this._screenAudioProducer);
        this._screenAudioProducer = null;
        this._screenAudioTrack = null;
    }

    _onMicAnalyserScoreUpdated(data: any) {
        this._micAnalyserDebugger?.onScoreUpdated?.(data);
        this._sendMicScore(this._micPaused ? 0 : data.out);
    }

    /**
     * streamId is "0" if this is the webcam/mic stream, and a proper streamId
     * if this is a screen share.
     *
     * For the webcam/mic stream, this is only called once, on RTC initialization.
     * For screen shares, this is called every time a new screen share is started.
     *
     * This is called when the user wants to start sending a stream. This
     * can be either a screen sharing stream or a camera stream with their
     * respective audio tracks.
     *
     * @param {string | "0"} streamId
     * @param {MediaStream} stream
     */
    addNewStream(
        streamId: string,
        stream: MediaStream,
        audioPaused: boolean,
        videoPaused: boolean,
        beforeEffectTracks: CustomMediaStreamTrack[] = [],
    ) {
        if (streamId === "0") {
            this._micPaused = audioPaused;
            this._webcamPaused = videoPaused;

            const videoTrack = stream.getVideoTracks()[0] as CustomMediaStreamTrack;
            const audioTrack = stream.getAudioTracks()[0] as CustomMediaStreamTrack;

            if (videoTrack) {
                this._sendWebcam(videoTrack);
                if (!videoTrack.effectTrack) {
                    this._monitorVideoTrack(videoTrack);
                }
                const beforeEffectTrack = beforeEffectTracks.find((t) => t.kind === "video");
                if (beforeEffectTrack) {
                    this._monitorVideoTrack(beforeEffectTrack);
                }
            }
            if (audioTrack) {
                this._sendMic(audioTrack);
                this._syncMicAnalyser();
                if (!audioTrack.effectTrack) {
                    this._monitorAudioTrack(audioTrack);
                }
                const beforeEffectTrack = beforeEffectTracks.find((t) => t.kind === "audio");
                if (beforeEffectTrack) {
                    this._monitorAudioTrack(beforeEffectTrack);
                }
            }

            // This should not be needed, but checking nonetheless
            if (this._localStreamDeregisterFunction) {
                this._localStreamDeregisterFunction();
                this._localStreamDeregisterFunction = null;
            }

            const localStreamHandler = (e: any) => {
                const { enable, track } = e.detail;

                // This is a hack
                this._webcamPaused = !enable;
                this._pauseResumeWebcam();

                this._handleStopOrResumeVideo({ enable, track });
            };

            stream.addEventListener("stopresumevideo", localStreamHandler);
            this._localStreamDeregisterFunction = () => {
                stream.removeEventListener("stopresumevideo", localStreamHandler);
            };
        } else {
            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];

            if (videoTrack) this._sendScreenVideo(videoTrack);
            if (audioTrack) this._sendScreenAudio(audioTrack);

            this._emitScreenshareStarted();
        }
    }

    _syncMicAnalyser() {
        if (this._micTrack && this._colocation && !this._micAnalyser) {
            this._micAnalyser = createMicAnalyser({
                micTrack: this._micTrack,
                onScoreUpdated: this._onMicAnalyserScoreUpdated.bind(this),
            });
            return;
        }
        if (this._micAnalyser && !this._colocation) {
            this._micAnalyser.close();
            this._micAnalyser = null;
            return;
        }
    }

    /**
     * Only for mic.
     *
     * This is called when the PWA toggles the audio on or off.
     *
     * @param {MediaStream} stream
     * @param {boolean} enabled
     */
    stopOrResumeAudio(stream: MediaStream, enabled: boolean) {
        logger.info("stopOrResumeAudio() [enabled:%s]", enabled);

        this._micPaused = !enabled;

        this._pauseResumeMic();
    }

    _handleStopOrResumeVideo({ enable, track }: { enable: boolean; track: MediaStreamTrack }) {
        if (!enable) {
            if (this._webcamProducer && !this._webcamProducer.closed && this._webcamProducer.track === track) {
                this._stopProducer(this._webcamProducer);
                this._webcamProducer = null;
                this._webcamTrack = null;
            }
        } else {
            this._sendWebcam(track);
        }
    }
    /**
     * Only for webcam.
     *
     * This is called when the PWA toggles the webcam on or off.
     * @param {MediaStream} stream
     * @param {boolean} enabled
     */
    stopOrResumeVideo(localStream: MediaStream, enable: boolean) {
        logger.info("stopOrResumeVideo() [enable:%s]", enable);

        this._webcamPaused = !enable;

        this._pauseResumeWebcam();

        if (!["chrome", "safari"].includes(browserName)) {
            return;
        }

        // actually turn off the camera. Chrome-only (Firefox etc. has different plans)

        if (!enable) {
            clearTimeout(this._stopCameraTimeout);

            const stopCameraDelay =
                localStream.getVideoTracks().find((t: CustomMediaStreamTrack) => !t.enabled)?.readyState === "ended"
                    ? 0
                    : 5000;

            // try to stop the local camera so the camera light goes off.
            this._stopCameraTimeout = setTimeout(() => {
                localStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
                    if (track.enabled === false) {
                        track.stop();
                        localStream.removeTrack(track);

                        this._emitToPWA(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_REMOVED, {
                            stream: localStream,
                            track,
                        });

                        this._handleStopOrResumeVideo({ enable, track });
                    }
                });
            }, stopCameraDelay);
        } else if (localStream.getVideoTracks().length === 0) {
            // re-enable the stream
            const constraints = this._webrtcProvider.getMediaConstraints().video;
            navigator.mediaDevices.getUserMedia({ video: constraints }).then((stream) => {
                const track = stream.getVideoTracks()[0];
                localStream.addTrack(track);
                this._monitorVideoTrack(track);

                this._emitToPWA(CONNECTION_STATUS.EVENTS.LOCAL_STREAM_TRACK_ADDED, {
                    streamId: localStream.id,
                    tracks: [track],
                    screenShare: false,
                });

                this._handleStopOrResumeVideo({ enable, track });
            });
        }
    }

    supportsScreenShareAudio() {
        return true;
    }

    /**
     * If the streamId and clientId are the same, this is a webcam/mic stream.
     * Otherwise, this is a screen share stream.
     *
     * @param {{
     *     streamId: string,
     *     clientId: string,
     * }} streamOptions
     */
    acceptNewStream({ streamId, clientId }: { streamId: string; clientId: string }) {
        logger.info("acceptNewStream()", { streamId, clientId });

        const clientState = this._getOrCreateClientState(clientId);
        const isScreenShare = streamId !== clientId;

        if (isScreenShare) {
            clientState.hasAcceptedScreenStream = true;
            clientState.hasEmittedScreenStream = false; // re-emit stream if re-accepted
        } else {
            clientState.hasAcceptedWebcamStream = true;
            clientState.hasEmittedWebcamStream = false; // re-emit stream if re-accepted
        }

        this._syncIncomingStreamsWithPWA(clientId);
    }

    /**
     * This is called when the user resizes their window such that we neee to
     * update the consumer layers.
     *
     * @param {string} streamId
     * @param {ignored} _ignored
     * @param {{
     *    width: number,
     *    height: number,
     * }} size
     */
    updateStreamResolution(
        streamId: string,
        _ignored: any,
        {
            width,
            height,
        }: {
            width: number;
            height: number;
        },
    ) {
        logger.info("updateStreamResolution()", { streamId, width, height });

        const consumerId = this._streamIdToVideoConsumerId.get(streamId);
        const consumer = this._consumers.get(consumerId);

        if (!consumer) {
            this._streamIdToVideoResolution.set(streamId, { width, height });
            return;
        }

        const numberOfActiveVideos = getNumberOfActiveVideos(this._consumers);
        const numberOfTemporalLayers = getNumberOfTemporalLayers(consumer);

        const { spatialLayer, temporalLayer } = getLayers(
            { width, height },
            {
                numberOfActiveVideos,
                numberOfTemporalLayers,
                uncappedSingleRemoteVideoOn: this._features?.uncappedSingleRemoteVideoOn,
            },
        );

        if (consumer.appData.spatialLayer !== spatialLayer || consumer.appData.temporalLayer !== temporalLayer) {
            consumer.appData.spatialLayer = spatialLayer;
            consumer.appData.temporalLayer = temporalLayer;

            this._vegaConnection?.message("setConsumersPreferredLayers", {
                consumerIds: [consumerId],
                spatialLayer,
                temporalLayer,
            });
        }
    }

    disconnectAll() {
        this._reconnect = false;
        if (this._reconnectTimeOut) {
            clearTimeout(this._reconnectTimeOut);
            this._reconnectTimeOut = null;
        }
        this._socketListenerDeregisterFunctions.forEach((func: any) => {
            func();
        });

        if (this._localStreamDeregisterFunction) {
            this._localStreamDeregisterFunction();
            this._localStreamDeregisterFunction = null;
        }

        this._socketListenerDeregisterFunctions = [];

        this._vegaConnection?.removeAllListeners();
        this._vegaConnection?.close();

        // These will clean up any and all producers/consumers
        this._sendTransport?.close();
        this._receiveTransport?.close();

        this._micTrack = null;
        this._webcamTrack = null;
        this._screenVideoTrack = null;
        this._screenAudioTrack = null;

        this._streamIdToVideoConsumerId.clear();

        this._mediasoupDeviceInitializedAsync = Promise.resolve(null);
    }

    sendAudioMutedStats(muted: boolean) {
        rtcStats.sendEvent("audio_muted", { muted });
    }

    sendVideoMutedStats(muted: boolean) {
        rtcStats.sendEvent("video_muted", { muted });
    }

    sendStatsCustomEvent(eventName: string, data?: any) {
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

    _monitorAudioTrack(track: any) {
        if (this._audioTrackBeingMonitored?.id === track.id) return;

        this._audioTrackBeingMonitored?.removeEventListener("ended", this._audioTrackOnEnded);
        track.addEventListener("ended", this._audioTrackOnEnded);
        this._audioTrackBeingMonitored = track;
    }

    _monitorVideoTrack(track: CustomMediaStreamTrack) {
        if (this._videoTrackBeingMonitored?.id === track.id) return;

        this._videoTrackBeingMonitored?.removeEventListener("ended", this._videoTrackOnEnded);
        track.addEventListener("ended", this._videoTrackOnEnded);
        this._videoTrackBeingMonitored = track;
    }

    async _onMessage(message: any) {
        const { method, data } = message;
        return Promise.resolve()
            .then(() => {
                switch (method) {
                    case "consumerReady":
                        return this._onConsumerReady(data);
                    case "consumerClosed":
                        return this._onConsumerClosed(data);
                    case "consumerPaused":
                        return this._onConsumerPaused(data);
                    case "consumerResumed":
                        return this._onConsumerResumed(data);
                    case "dataConsumerReady":
                        return this._onDataConsumerReady(data);
                    case "dataConsumerClosed":
                        return this._onDataConsumerClosed(data);
                    case "dominantSpeaker":
                        return this._onDominantSpeaker(data);
                    case "consumerScore":
                        return this._onConsumerScore(data);
                    case "producerScore":
                        return this._onProducerScore(data);
                    default:
                        logger.info(`unknown message method "${method}"`);
                        return;
                }
            })
            .catch((error) => {
                logger.error('"message" failed [error:%o]', error);
            });
    }

    async _onConsumerReady(options: any) {
        logger.info("_onConsumerReady()", { id: options.id, producerId: options.producerId });

        const consumer = await this._receiveTransport.consume(options);

        consumer.pause();
        consumer.appData.localPaused = true;
        consumer.appData.spatialLayer = 2;

        this._consumers.set(consumer.id, consumer);
        this._qualityMonitor.addConsumer(consumer.appData.sourceClientId, consumer.id);
        consumer.observer.once("close", () => {
            this._consumers.delete(consumer.id);
            this._qualityMonitor.removeConsumer(consumer.appData.sourceClientId, consumer.id);

            this._consumerClosedCleanup(consumer);
        });

        if (this._features.increaseIncomingMediaBufferOn && consumer.rtpReceiver) {
            try {
                consumer.rtpReceiver.jitterBufferTarget = MEDIA_JITTER_BUFFER_TARGET;
                // Legacy Chrome API
                consumer.rtpReceiver.playoutDelayHint = MEDIA_JITTER_BUFFER_TARGET / 1000; // seconds
            } catch (error) {
                logger.error("Error during setting jitter buffer target:", error);
            }
        }

        const { sourceClientId: clientId, screenShare, streamId } = consumer.appData;
        const clientState = this._getOrCreateClientState(clientId);

        if (screenShare) {
            clientState.hasEmittedScreenStream = false; // re-emit stream if updated
            clientState.screenShareStreamId = streamId;
        } else {
            clientState.hasEmittedWebcamStream = false; // re-emit stream if updated
            clientState.camStreamId = streamId;
        }

        let stream = screenShare ? clientState.screenStream : clientState.webcamStream;

        if (!stream || stream.inboundId !== streamId) {
            stream = new MediaStream();

            stream.inboundId = streamId;
            screenShare ? (clientState.screenStream = stream) : (clientState.webcamStream = stream);
        }

        if (consumer.kind === "video") {
            this._streamIdToVideoConsumerId.set(stream.id, consumer.id);
        }

        stream.addTrack(consumer.track);
        this._syncIncomingStreamsWithPWA(clientId);

        // Update resolution if we already have it
        const resolution = this._streamIdToVideoResolution.get(stream.id);
        if (resolution) {
            this.updateStreamResolution(stream.id, null, resolution);
            this._streamIdToVideoResolution.delete(stream.id);
        }
    }

    async _onConsumerClosed({ consumerId, reason }: { consumerId: string; reason: string }) {
        logger.info("_onConsumerClosed()", { consumerId, reason });

        this._consumers.get(consumerId)?.close();
    }

    _onConsumerPaused({ consumerId }: { consumerId: string }) {
        logger.info("_onConsumerPaused()", { consumerId });

        const consumer = this._consumers.get(consumerId);

        if (!consumer) return;

        consumer.appData.remotePaused = true;
        consumer.pause();
    }

    _onConsumerResumed({ consumerId }: { consumerId: string }) {
        logger.info("_onConsumerResumed()", { consumerId });

        const consumer = this._consumers.get(consumerId);

        if (!consumer) return;

        consumer.appData.remotePaused = false;

        if (!consumer.appData.localPaused) {
            consumer.resume();
        }
    }

    _onConsumerScore({ consumerId, kind, score }: { consumerId: string; kind: string; score: number }) {
        logger.info("_onConsumerScore()", { consumerId, kind, score });
        const {
            appData: { sourceClientId },
        } = this._consumers.get(consumerId) || { appData: {} };

        if (sourceClientId) {
            this._qualityMonitor.addConsumerScore(sourceClientId, consumerId, kind, score);
        }
    }

    _onProducerScore({ producerId, kind, score }: { producerId: string; kind: string; score: number }) {
        logger.info("_onProducerScore()", { producerId, kind, score });
        [this._micProducer, this._webcamProducer, this._screenVideoProducer, this._screenAudioProducer].forEach(
            (producer) => {
                if (producer?.id === producerId) {
                    this._qualityMonitor.addProducerScore(this._selfId, producerId, kind, score);
                }
            },
        );
    }

    async _onDataConsumerReady(options: any) {
        logger.info("_onDataConsumerReady()", { id: options.id, producerId: options.producerId });
        const consumer = await this._receiveTransport.consumeData(options);

        this._dataConsumers.set(consumer.id, consumer);
        consumer.once("close", () => {
            this._dataConsumers.delete(consumer.id);
        });

        const { clientId } = consumer.appData;

        consumer.on("message", (message: string) => {
            // for now we only use this for score, so ignore messages when no debugger is attached
            if (!this._micAnalyserDebugger) return;

            if (typeof message !== "string") return;

            const { score } = JSON.parse(message);
            if (score) {
                this._micAnalyserDebugger?.onConsumerScore(consumer.appData.clientId, score);
            }
        });

        this._syncIncomingStreamsWithPWA(clientId);
    }

    async _onDataConsumerClosed({ dataConsumerId, reason }: { dataConsumerId: string; reason: string }) {
        logger.info("_onDataConsumerClosed()", { dataConsumerId, reason });
        const consumer = this._dataConsumers.get(dataConsumerId);
        consumer?.close();
    }

    _onDominantSpeaker({ consumerId }: { consumerId: string }) {
        const consumer = this._consumers.get(consumerId);

        if (!consumer) return;

        const { sourceClientId: clientId } = consumer.appData;

        this._emitToPWA(rtcManagerEvents.DOMINANT_SPEAKER, { clientId });
    }

    _consumerClosedCleanup(consumer: any) {
        const { sourceClientId: clientId, screenShare } = consumer.appData;
        const clientState = this._getOrCreateClientState(clientId);
        const stream = screenShare ? clientState.screenStream : clientState.webcamStream;

        if (!stream) return;

        stream.removeTrack(consumer.track);

        if (stream.getTracks().length === 0) {
            this._streamIdToVideoConsumerId.delete(stream.id);
            this._streamIdToVideoResolution.delete(stream.id);

            // We need to clean up our clientState
            // TODO: @geirbakke investigate missing mic audio if screenshare starts during reconnect
            if (screenShare) {
                clientState.screenStream = undefined;
                clientState.hasEmittedScreenStream = false;
                clientState.screenShareStreamId = undefined;
            } else {
                // We never reset the webcam stream
                clientState.hasEmittedWebcamStream = false;
                clientState.camStreamId = undefined;
            }
        }
    }

    _syncIncomingStreamsWithPWA(clientId: string) {
        const clientState = this._getOrCreateClientState(clientId);

        const {
            webcamStream,
            screenStream,
            hasEmittedWebcamStream,
            hasEmittedScreenStream,
            hasAcceptedWebcamStream,
            hasAcceptedScreenStream,
            screenShareStreamId,
            camStreamId,
        } = clientState;

        // Need to pause/resume any consumers that are part of a stream that has been
        // accepted or disconnected by the PWA
        const toPauseConsumers: any[] = [];
        const toResumeConsumers: any[] = [];

        this._consumers.forEach((consumer: any) => {
            if (consumer.appData.sourceClientId !== clientId) return;

            const hasAccepted = consumer.appData.screenShare ? hasAcceptedScreenStream : hasAcceptedWebcamStream;

            if (!consumer.appData.localPaused !== hasAccepted) {
                if (hasAccepted) {
                    if (!consumer.appData.remotePaused) {
                        consumer.resume();
                    }
                    consumer.appData.localPaused = false;
                    toResumeConsumers.push(consumer.id);
                } else {
                    consumer.pause();
                    consumer.appData.localPaused = true;
                    toPauseConsumers.push(consumer.id);
                }
            }
        });

        if (toPauseConsumers.length > 0) {
            this._vegaConnection?.message("pauseConsumers", {
                consumerIds: toPauseConsumers,
            });
        }

        if (toResumeConsumers.length > 0) {
            this._vegaConnection?.message("resumeConsumers", {
                consumerIds: toResumeConsumers,
            });
        }

        // If the webcam stream has not been emitted, we emit it.
        if (webcamStream && !hasEmittedWebcamStream && hasAcceptedWebcamStream) {
            this._emitToPWA(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                clientId,
                stream: webcamStream,
                streamId: camStreamId,
                streamType: "webcam",
            });

            clientState.hasEmittedWebcamStream = true;
        }

        // If the screen stream has not been emitted, we emit it.
        if (screenStream && !hasEmittedScreenStream && hasAcceptedScreenStream) {
            this._emitToPWA(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                clientId,
                stream: screenStream,
                streamId: screenShareStreamId,
                streamType: "screenshare",
            });

            clientState.hasEmittedScreenStream = true;
        }
    }

    _getOrCreateClientState(clientId: string) {
        let clientState = this._clientStates.get(clientId);

        if (!clientState) {
            clientState = {
                hasAcceptedWebcamStream: false,
                hasAcceptedScreenStream: false,
                hasEmittedWebcamStream: false,
                hasEmittedScreenStream: false,
            };

            this._clientStates.set(clientId, clientState);
        }

        return clientState;
    }

    _emitToPWA(eventName: string, data?: any) {
        this._emitter.emit(eventName, data);
    }

    _emitToSignal(eventName: string, data?: any, callback?: any) {
        this._serverSocket.emit(eventName, data, callback);
    }

    // this tells PWA that clients/streams should be accepted from both sides (in contrast with current P2P manager)
    shouldAcceptStreamsFromBothSides() {
        return true;
    }

    setMicAnalyserDebugger(analyserDebugger: any) {
        this._micAnalyserDebugger = analyserDebugger;
    }

    setMicAnalyserParams(params: any) {
        this._micAnalyser?.setParams(params);
    }

    hasClient(clientId: string) {
        return this._clientStates.has(clientId);
    }
}
