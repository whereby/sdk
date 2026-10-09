import { Device } from "mediasoup-client";
import adapterRaw from "webrtc-adapter";
import { v4 as uuidv4 } from "uuid";

import rtcManagerEvents from "../rtcManagerEvents";
import rtcStats from "../rtcStatsService";
import createMicAnalyser from "../VegaMicAnalyser";
import {
    AddCameraStreamOptions,
    RemoveScreenshareStreamOptions,
    RtcManager,
    SignalMediaServerConfig,
    SignalSFUServer,
    VegaRtcManagerOptions,
} from "../types";
import VegaMediaQualityMonitor from "../VegaMediaQualityMonitor";
import {
    CAM_SAMPLES_SKIPPED_AFTER_CANDIDATE_PAIR_CHANGE,
    CONGESTED_FRACTION_LOST,
    CONGESTED_RTT_INFLATION_MS,
    INITIAL_CONSUMER_SPATIAL_LAYER,
    MAX_CONCURRENT_PREFERRED_LAYER_SWITCH_WATCHES,
    MEDIA_JITTER_BUFFER_TARGET,
    PREFERRED_LAYER_SWITCH_POLL_INTERVAL_MS,
    PREFERRED_LAYER_SWITCH_WATCH_TIMEOUT_MS,
} from "../constants";

import { PROTOCOL_EVENTS, PROTOCOL_REQUESTS, PROTOCOL_RESPONSES } from "../../model/protocol";
import * as CONNECTION_STATUS from "../../model/connectionStatusConstants";
import { getMediaSettings, modifyMediaCapabilities } from "../../utils/mediaSettings";
import { getMediasoupDeviceAsync } from "../../utils/getMediasoupDevice";
import { maybeTurnOnly, turnServerOverride } from "../../utils/iceServers";
import Logger from "../../utils/Logger";
import {
    addProducerCpuOveruseWatch,
    aggregateMetricStats,
    createMetricStats,
    getInitialHighestPreferredLayer,
    getLayers,
    getNumberOfActiveVideos,
    getNumberOfTemporalLayers,
    getPacketWeightedFractionLost,
    getReducedSvcEncodingParams,
    MetricStats,
    recordMetricSample,
} from "./utils";
import { ServerSocket, trackAnnotations } from "../../utils";
import { createVegaConnectionManager, HostListEntryOptionalDC } from "../VegaConnectionManager";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { subscribeStats, updateRenderedDimensions } from "../stats/StatsMonitor";
import { getPeerConnectionIndex } from "../stats/StatsMonitor/peerConnectionTracker";
import { SsrcStats } from "../stats/types";
import {
    VegaCreateTransportResponse,
    VegaGetCapabilitiesResponse,
    VegaRestartIceResponse,
    VegaProduceDataResponse,
    VegaProduceResponse,
    VegaAnalytics,
    ClientState,
    VegaTransportDirection,
    VegaAnalyticMetric,
    TransportAppData,
    ConsumerAppData,
    DataConsumerAppData,
    ProducerAppData,
    DataProducerAppData,
} from "./types";
import { TransportOptions } from "mediasoup-client/lib/Transport";
import VegaConnection from "../VegaConnection";
import { STREAM_TYPES } from "../../model";
import {
    ConsumerOptions,
    Producer,
    Consumer,
    Transport,
    DataProducer,
    DataConsumerOptions,
} from "mediasoup-client/lib/types";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;
const logger = new Logger();

const browserName = adapter.browserDetails.browser;
let unloading = false;

type RtpEncodingParametersWithScalabilityMode = RTCRtpEncodingParameters & { scalabilityMode?: string };

const RESTARTICE_ERROR_RETRY_THRESHOLD_IN_MS = 3500;
const RESTARTICE_ERROR_MAX_RETRY_COUNT = 5;
const OUTBOUND_CAM_OUTBOUND_STREAM_ID = uuidv4();
const OUTBOUND_SCREEN_OUTBOUND_STREAM_ID = uuidv4();

const getFrameArea = (frameSize?: { width?: number; height?: number }) =>
    (frameSize?.width ?? 0) * (frameSize?.height ?? 0);

if (browserName === "chrome") window.document.addEventListener("beforeunload", () => (unloading = true));

export default class VegaRtcManager implements RtcManager {
    _selfId: string;
    _room: any;
    _roomSessionId: any;
    _emitter: any;
    _serverSocket: ServerSocket;
    _webrtcProvider: any;
    _features: any;
    _eventClaim?: any;
    _vegaConnection: VegaConnection | null;
    _micAnalyser: any;
    _micAnalyserDebugger: any;
    _mediasoupDeviceInitializedAsync: Promise<Device | null>;
    _routerRtpCapabilities: RtpCapabilities | null;
    _sendTransport?: null | Transport<TransportAppData>;
    _receiveTransport?: null | Transport<TransportAppData>;
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
    _webcamProducerOriginalSvcScalabilityMode: string | undefined;
    _webcamProducerOriginalSvcMaxBitrate: number | undefined;
    _webcamProducerHighestPreferredLayer: number | undefined;
    _highestPreferredLayerUpdate: Promise<void> | null;
    _highestPreferredLayerUpdatePending: boolean;
    _webcamProducerPromise: any;
    _preferredLayerSwitchLatencyStats: MetricStats;
    _preferredLayerSwitchWatches: Map<string, { stop: () => void }>;
    _statsSubscription: { stop: () => void } | null;
    _lastSeenRemoteReportTimestamps: Map<string, number>;
    _camOutboundCandidatePairId: string | undefined;
    _camOutboundSamplesToSkip: number;
    _camOutboundPathRtt: { sumMs: number; count: number; minMs: number | undefined };
    _camOutboundRttInflation: { sumMs: number; count: number };
    _camOutboundSamples: { total: number; congested: number };
    _webcamPaused: any;
    _screenVideoProducer: any;
    _screenVideoProducerPromise: any;
    _screenAudioProducer: any;
    _screenAudioProducerPromise: any;
    _sndTransportIceRestartPromise: any;
    _rcvTransportIceRestartPromise: any;
    _colocation: any;
    _audioTrackOnEnded: any;
    _videoTrackOnEnded: any;
    _socketListenerDeregisterFunctions: any;
    _reconnect: any;
    _reconnectTimeOut: any;
    _qualityMonitor: VegaMediaQualityMonitor;
    _fetchMediaServersTimer: any;
    _iceServers: any;
    _turnServers: any;
    _sfuServer?: SignalSFUServer;
    _sfuServers?: HostListEntryOptionalDC[];
    _mediaserverConfigTtlSeconds: any;
    _videoTrackBeingMonitored?: MediaStreamTrack;
    _audioTrackBeingMonitored?: MediaStreamTrack;
    _isConnectingOrConnected: boolean;
    _vegaConnectionManager?: ReturnType<typeof createVegaConnectionManager>;
    _networkIsDetectedUpBySignal: boolean;
    _cpuOveruseDetected: boolean;
    // Temporary telemetry: measures how long the SFU WebSocket stays open ("zombie" — alive to the
    // OS, dead in reality) after the browser reports offline, until it actually closes.
    _sfuZombie: {
        offlineDetectedAt: number | null;
        onBrowserOffline: any;
    };
    analytics: VegaAnalytics;

    constructor({ selfId, room, emitter, serverSocket, webrtcProvider, features, eventClaim }: VegaRtcManagerOptions) {
        const { session, iceServers, turnServers, sfuServer, mediaserverConfigTtlSeconds } = room;

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
        this._webcamProducerOriginalSvcScalabilityMode = undefined;
        this._webcamProducerOriginalSvcMaxBitrate = undefined;
        this._webcamProducerHighestPreferredLayer = undefined;
        this._highestPreferredLayerUpdate = null;
        this._highestPreferredLayerUpdatePending = false;
        this._webcamProducerPromise = null;
        this._webcamPaused = false;
        this._screenVideoProducer = null;
        this._screenVideoProducerPromise = null;
        this._screenAudioProducer = null;
        this._screenAudioProducerPromise = null;

        this._sndTransportIceRestartPromise = null;
        this._rcvTransportIceRestartPromise = null;

        this._colocation = null;

        this._audioTrackOnEnded = () => {
            // There are a couple of reasons the microphone could stop working.
            // One of them is getting unplugged. The other is the Chrome audio
            // process crashing. The third is the tab being closed.
            // https://bugs.chromium.org/p/chromium/issues/detail?id=1050008
            rtcStats.sendEvent("audio_ended", { unloading });
            this._emitToPWA(rtcManagerEvents.MICROPHONE_STOPPED_WORKING, {});
            this.analytics.micTrackEndedCount++;
        };
        this._videoTrackOnEnded = () => {
            rtcStats.sendEvent("video_ended", { unloading });
            this._emitToPWA(rtcManagerEvents.CAMERA_STOPPED_WORKING, {});
            this.analytics.camTrackEndedCount++;
        };

        this._updateAndScheduleMediaServersRefresh({
            sfuServer,
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

        // Temporary telemetry: how late the SFU WebSocket closes after the browser reports offline.
        // The `offline` event is our "connection likely dead" signal — the same one the signalling
        // transport rides to reconnect; we record it but do not act on it here. Results are written
        // onto the analytics object.
        this._sfuZombie = {
            offlineDetectedAt: null,
            onBrowserOffline: () => this._sfuZombieOnOffline(),
        };
        window?.addEventListener?.("offline", this._sfuZombie.onBrowserOffline); // browser-only

        this.analytics = {
            avgPreferredLayerSwitchLatencyMs: undefined,
            camOutboundCongestedFraction: undefined,
            camOutboundRttInflationMs: undefined,
            camTrackEndedCount: 0,
            highestPreferredLayerChangeCounts: {},
            micTrackEndedCount: 0,
            numHighestPreferredLayerChanges: 0,
            numIceConnected: 0,
            numIceDisconnected: 0,
            numIceFailed: 0,
            numNewPc: 0,
            numPreferredSpatialLayerChanges: 0,
            preferredSpatialLayerChangeCounts: {},
            sfuMsFromOfflineToClose: 0,
            sfuOfflineToCloseCount: 0,
            sfuOfflineWhileConnectedCount: 0,
            vegaConsumerCreationFailed: 0,
            vegaCreateTransportWithoutVegaConnection: 0,
            vegaIceRestartMissingTransport: 0,
            vegaIceRestarts: 0,
            vegaIceRestartWrongTransportId: 0,
            vegaJoinFailed: 0,
            vegaJoinWithoutVegaConnection: 0,
            vegaMicProducerClosed: 0,
            vegaMicProducerFailed: 0,
            vegaReplaceTrackNoProducerNoEnabledTrack: 0,
            vegaRequestTimeout: 0,
            vegaScreenAudioProducerFailed: 0,
            vegaScreenVideoProducerFailed: 0,
            vegaUnknownResponse: 0,
            vegaWebcamProducerFailed: 0,
        };

        this._preferredLayerSwitchLatencyStats = createMetricStats();
        this._preferredLayerSwitchWatches = new Map();

        this._lastSeenRemoteReportTimestamps = new Map();
        this._camOutboundCandidatePairId = undefined;
        this._camOutboundSamplesToSkip = 0;
        this._camOutboundPathRtt = { sumMs: 0, count: 0, minMs: undefined };
        this._camOutboundRttInflation = { sumMs: 0, count: 0 };
        this._camOutboundSamples = { total: 0, congested: 0 };
        this._statsSubscription = null;
    }

    _updateAndScheduleMediaServersRefresh({
        iceServers,
        turnServers,
        sfuServer,
        mediaserverConfigTtlSeconds,
    }: SignalMediaServerConfig) {
        this._iceServers = iceServers;
        this._turnServers = turnServers;

        if (sfuServer) {
            this._sfuServer = sfuServer;
        }

        // support packing list of sfuServers inside existing sfuServer prop
        if (sfuServer?.fallbackServers) {
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
                this._sfuServer?.url,
        );

        const iceServersList = {
            iceServers: this._features.turnServersOn ? this._turnServers : this._iceServers,
        };

        iceServersList.iceServers = turnServerOverride(
            iceServersList.iceServers,
            this._features.turnServerOverrideHost,
        );

        if (browserName !== "firefox") {
            this._sendTransport?.updateIceServers(iceServersList);
            this._receiveTransport?.updateIceServers(iceServersList);
        }

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

    _sfuZombieOnOffline() {
        // Browser went offline while we hold an SFU WS — the moment we believe it's dead. Record the
        // first such offline (a burst counts once); the gap to `_onClose` is how long the WS stays a
        // zombie, which riding offline would cut.
        if (!this._isConnectingOrConnected || this._sfuZombie.offlineDetectedAt !== null) {
            return;
        }
        this._sfuZombie.offlineDetectedAt = Date.now();
        this.analytics.sfuOfflineWhileConnectedCount++;

        rtcStats.sendEvent("SfuOfflineWhileConnected", {
            sfuWsReadyState: this._vegaConnection?.socket?.readyState,
            sendTransportState: this._sendTransport?.connectionState,
            recvTransportState: this._receiveTransport?.connectionState,
        });
    }

    _sfuZombieReset() {
        this._sfuZombie.offlineDetectedAt = null;
    }

    _sfuZombieOnClose(): number | undefined {
        // The SFU WS closed. If we believed it dead (offline) and this is an unexpected close, bank
        // how long after that it actually closed — the zombie time riding offline would cut. Only a
        // real close counts: a WS that survives the offline (self-heals) never closes, so it adds
        // nothing, keeping sfuMsFromOfflineToClose free of survived-offline inflation. A clean leave
        // runs disconnectAll first, which clears _reconnect. Returns the gap for the rtcstats event.
        let msFromOfflineToClose: number | undefined;
        if (this._reconnect && this._sfuZombie.offlineDetectedAt !== null) {
            msFromOfflineToClose = Date.now() - this._sfuZombie.offlineDetectedAt;
            this.analytics.sfuMsFromOfflineToClose += msFromOfflineToClose;
            this.analytics.sfuOfflineToCloseCount++;
        }
        this._sfuZombieReset();
        return msFromOfflineToClose;
    }

    setupSocketListeners() {
        this._socketListenerDeregisterFunctions.push(
            () => this._clearMediaServersRefresh(),

            this._serverSocket.on(PROTOCOL_RESPONSES.MEDIASERVER_CONFIG, (data: SignalMediaServerConfig) => {
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
        if (this._isConnectingOrConnected) {
            // TEMP investigation event for COB-2771 — remove once understood
            rtcStats.sendEvent("SfuConnectEarlyBail", {
                readyState: this._vegaConnection?.socket?.readyState,
                bufferedAmount: this._vegaConnection?.socket?.bufferedAmount,
            });
            return;
        }

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
                this._sfuServer?.url;

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
                onAttemptFailed: ({ host, dc }) => {
                    rtcStats.sendEvent("SfuConnectAttemptFailed", { host, dc });
                },
            });
        }
        this._vegaConnectionManager.connect((metric: VegaAnalyticMetric) => this.analytics[metric]++);
        this._isConnectingOrConnected = true;
    }

    _onClose() {
        logger.info("_onClose()");

        // These will clean up any and all producers/consumers
        this._sendTransport?.close();
        this._receiveTransport?.close();
        this._sendTransport = null;
        this._receiveTransport = null;

        // Clear all mappings we have, except the app's last requested resolution per stream: the app only updates it
        // when a tile's size changes, so it's re-applied to the consumers created after reconnecting
        this._streamIdToVideoConsumerId.clear();

        if (this._reconnect) {
            this._reconnectTimeOut = setTimeout(() => this._connect(), 1000);
        }

        this._qualityMonitor.close();
        this._emitToPWA(rtcManagerEvents.SFU_CONNECTION_CLOSED);

        const msFromOfflineToClose = this._sfuZombieOnClose();
        rtcStats.sendEvent("SfuConnectionClosed", { msFromOfflineToClose });
    }

    async _join() {
        logger.info("_join()");
        this._emitToPWA(rtcManagerEvents.SFU_CONNECTION_OPEN);
        rtcStats.sendEvent("SfuConnectionOpened", {});

        try {
            if (!this._vegaConnection) {
                logger.error("_join() No VegaConnection found");
                this.analytics.vegaJoinWithoutVegaConnection++;
                rtcStats.sendEvent("JoinWithoutVegaConnection", {});
                throw new Error("No VegaConnection found");
            }
            // We need to always do this, as this triggers the join logic on the SFU
            const { routerRtpCapabilities } = (await this._vegaConnection.request(
                "getCapabilities",
            )) as VegaGetCapabilitiesResponse;

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
            this.analytics.vegaJoinFailed++;
            rtcStats.sendEvent("VegaJoinFailed", { error });
            // TODO: handle this error, rejoin?
        }
    }

    async _createTransport(send: boolean) {
        if (!this._vegaConnection) {
            logger.error("_createTransport() No VegaConnection found");
            this.analytics.vegaCreateTransportWithoutVegaConnection++;
            rtcStats.sendEvent("CreateTransportWithoutVegaConnection", {});
            throw new Error("No VegaConnection found");
        }
        const creator = send ? "createSendTransport" : "createRecvTransport";

        const optionsFromSfu = (await this._vegaConnection.request("createTransport", {
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
        })) as VegaCreateTransportResponse;

        const transportOptions = {
            ...optionsFromSfu,
        } as TransportOptions;

        transportOptions.iceServers = turnServerOverride(
            this._features.turnServersOn ? this._turnServers : this._iceServers,
            this._features.turnServerOverrideHost,
        );

        maybeTurnOnly(transportOptions, this._features);

        const transport = (await this._mediasoupDeviceInitializedAsync)?.[creator](transportOptions) as
            | Transport<TransportAppData>
            | undefined;
        this.analytics.numNewPc++;

        const onConnectionStateListener = async (connectionState: any) => {
            logger.info(`Transport ConnectionStateChanged ${connectionState}`);

            switch (connectionState) {
                case "connected":
                    this.analytics.numIceConnected++;
                    break;
                case "disconnected":
                    this.analytics.numIceDisconnected++;
                    break;
                case "failed":
                    this.analytics.numIceFailed++;
                    break;
                default:
                    break;
            }

            if (connectionState !== "disconnected" && connectionState !== "failed") {
                return;
            }
            if (send) {
                if (this._sndTransportIceRestartPromise || !transport?.id) {
                    return;
                }
                this._sndTransportIceRestartPromise = this._restartIce("send", transport.id)
                    .catch((e) => logger.error(e))
                    .finally(() => {
                        this._sndTransportIceRestartPromise = null;
                    });
            } else {
                if (this._rcvTransportIceRestartPromise || !transport?.id) {
                    return;
                }
                this._rcvTransportIceRestartPromise = this._restartIce("recv", transport.id)
                    .catch((e) => logger.error(e))
                    .finally(() => {
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

                        const { id } = (await this._vegaConnection?.request("produce", {
                            transportId: transport.id,
                            kind,
                            rtpParameters,
                            paused,
                            appData,
                        })) as VegaProduceResponse;

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
                        const { id } = (await this._vegaConnection?.request("produceData", {
                            transportId: transport.id,
                            sctpStreamParameters,
                            appData,
                        })) as VegaProduceDataResponse;
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

    async _restartIce(direction: VegaTransportDirection, transportId: string, retried = 0) {
        this.analytics.vegaIceRestarts++;
        const transport = direction === "send" ? this._sendTransport : this._receiveTransport;
        if (!transport) {
            logger.info(`_restartIce: No transport found with id ${transportId}`);
            this.analytics.vegaIceRestartMissingTransport++;
            return;
        }

        if (transport.id !== transportId) {
            logger.info(
                `_restartIce: Transport ids does not match [expected: ${transportId}, actual: ${transport.id}]`,
            );
            this.analytics.vegaIceRestartWrongTransportId++;
            return;
        }

        if (!("closed" in transport) || !("connectionState" in transport)) {
            logger.info("_restartIce: Transport is missing closed or connectionState property");
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
        if (
            iceRestartStarted &&
            Number.isFinite(iceRestartStarted) &&
            now - iceRestartStarted < RESTARTICE_ERROR_RETRY_THRESHOLD_IN_MS
        ) {
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
        const { iceParameters } = (await this._vegaConnection.request("restartIce", {
            transportId: transport.id,
        })) as VegaRestartIceResponse;

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
                    await this._restartIce(direction, transportId, retried + 1);
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
            await this._restartIce(direction, transportId, retried + 1);
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

                const producer: Producer<ProducerAppData> = await this._sendTransport.produce({
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
                this.analytics.vegaMicProducerFailed++;
                rtcStats.sendEvent("VegaMicProducerFailed", { error });
                logger.error("micProducer failed:%o", error);
            } finally {
                this._micProducerPromise = null;

                // Has the track disappeared while we were waiting to be executed?
                if (!this._micTrack) {
                    this.analytics.vegaMicProducerClosed++;
                    rtcStats.sendEvent("VegaMicProducerClosed", {});
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
                if (!this._sendTransport) {
                    throw new Error("No send transport when attempting to create data producer");
                }

                const producer: DataProducer<DataProducerAppData> = await this._sendTransport.produceData({
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
                if (this._features.sfuHighestPreferredLayerTrackingOn) {
                    // combined with the SFU's highest preferred layer there, so neither can undo the other
                    this._syncWebcamEncoderToHighestPreferredLayer();
                    rtcStats.sendEvent("simulcast_layer_activation_changed", {
                        layerIndex: 2,
                        active: simulcastLayer3ShouldBeActive,
                    });
                    return;
                }

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

                if (!this._sendTransport) {
                    throw new Error("No send transport when attempting to create producer");
                }

                const producer: Producer<ProducerAppData> = await this._sendTransport.produce({
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
                const cleanUpCpuWatch = !this._features.producerCpuOveruseWatchOff
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
                if (this._features.sfuHighestPreferredLayerTrackingOn) {
                    const originalWebcamEncodings = producer.rtpSender?.getParameters()?.encodings as
                        | RtpEncodingParametersWithScalabilityMode[]
                        | undefined;
                    // only an SVC encoding is reduced through these, simulcast switches whole encodings on and off
                    const svcEncoding = originalWebcamEncodings?.length === 1 ? originalWebcamEncodings[0] : undefined;
                    this._webcamProducerOriginalSvcScalabilityMode = svcEncoding?.scalabilityMode;
                    this._webcamProducerOriginalSvcMaxBitrate = svcEncoding?.maxBitrate;

                    this._webcamProducerHighestPreferredLayer = originalWebcamEncodings?.length
                        ? getInitialHighestPreferredLayer(originalWebcamEncodings)
                        : undefined;

                    this._syncWebcamEncoderToHighestPreferredLayer();
                }
                this._qualityMonitor.addProducer(this._selfId, producer.id);
                producer.observer.once("close", () => {
                    logger.info('webcamProducer "close" event');

                    if (producer.appData.localClosed)
                        this._vegaConnection?.message("closeProducers", { producerIds: [producer.id] });

                    cleanUpCpuWatch();
                    this._stopWebcamStatsSubscription();

                    this._webcamProducer = null;
                    this._webcamProducerOriginalSvcScalabilityMode = undefined;
                    this._webcamProducerOriginalSvcMaxBitrate = undefined;
                    this._webcamProducerHighestPreferredLayer = undefined;
                    this._webcamProducerPromise = null;
                    this._qualityMonitor.removeProducer(this._selfId, producer.id);
                });
                this._startWebcamStatsSubscription();

                // Has someone replaced the track?
                if (this._webcamTrack && this._webcamTrack !== this._webcamProducer?.track) {
                    this._webcamProducerPromise = null;
                    this._replaceWebcamTrack();
                }
                if (this._webcamPaused !== this._webcamProducer.paused) this._pauseResumeWebcam();
            } catch (error) {
                this.analytics.vegaWebcamProducerFailed++;
                rtcStats.sendEvent("VegaWebcamProducerFailed", { error });
                logger.error("webcamProducer failed:%o", error);
            } finally {
                this._webcamProducerPromise = null;

                // Has the track disappeared while we were waiting to be executed?
                if (!this._webcamTrack) {
                    this._stopProducer(this._webcamProducer);
                    this._webcamProducer = null;
                    this._webcamProducerOriginalSvcScalabilityMode = undefined;
                    this._webcamProducerOriginalSvcMaxBitrate = undefined;
                    this._webcamProducerHighestPreferredLayer = undefined;
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

        if (!this._webcamProducer && (!this._webcamTrack || !this._webcamTrack.enabled)) {
            this.analytics.vegaReplaceTrackNoProducerNoEnabledTrack++;
            rtcStats.sendEvent("VegaReplaceTrackNoProducerNoEnabledTrack", {
                hasWebcamTrack: !!this._webcamTrack,
            });
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

                const producer: Producer<ProducerAppData> = await this._sendTransport.produce({
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
                this.analytics.vegaScreenVideoProducerFailed++;
                rtcStats.sendEvent("VegaScreenVideoProducerFailed", { error });
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

                const producer: Producer<ProducerAppData> = await this._sendTransport.produce({
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
                this.analytics.vegaScreenAudioProducerFailed++;
                rtcStats.sendEvent("VegaScreenAudioProducerFailed", { error });
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

    _stopProducer(producer: Producer) {
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

    // unused in Vega connections, SFU manages selectively forwarding streams to these clients
    setRemoteClientMediaPrefs() {}

    // unused in Vega connections, SFU manages selectively forwarding streams to these clients
    removeRemoteClientMediaPrefs() {}

    /**
     * The unique identifier for this room session.
     *
     * @param {string} roomSessionId
     */
    setRoomSessionId(roomSessionId: string) {
        this._roomSessionId = roomSessionId;
    }

    /**
     * The eventClaim is only used for SFU meetings.
     * It must be sent to the SFU to ensure that the SFU knows that the client has left.
     *
     * @param {string} clientId
     * @param {string} eventClaim
     */
    disconnect(clientId: string, eventClaim?: string) {
        logger.info("disconnect() [clientId:%s, eventClaim:%s]", clientId, eventClaim);

        const clientState = this._clientStates.get(clientId);
        if (clientState) {
            clientState.hasAcceptedWebcamStream = false;
            clientState.hasAcceptedScreenStream = false;
            // the client left, so its streams' requested resolutions aren't needed anymore
            [clientState.webcamStream, clientState.screenStream].forEach(
                (stream) => stream && this._streamIdToVideoResolution.delete(stream.id),
            );
            this._syncIncomingStreamsWithPWA(clientId);
        }

        if (eventClaim) {
            this._eventClaim = eventClaim;
            this._vegaConnection?.message("eventClaim", { eventClaim });
        }
    }

    replaceTrack(_: MediaStreamTrack | null, track: MediaStreamTrack) {
        logger.info("replaceTrack() [kind: %s, id: %s, readyState: %s]", track.kind, track.id, track.readyState);
        if (track.readyState === "ended") {
            logger.error(`refusing to use ended track with id: ${track.id}, kind: ${track.kind}`);
            return;
        }

        if (track.kind === "audio") {
            if (!trackAnnotations(track).isEffectTrack) {
                this._monitorAudioTrack(track);
            }
            this._micTrack = track;
            this._replaceMicTrack();
        }

        if (track.kind === "video") {
            if (!trackAnnotations(track).isEffectTrack) {
                this._monitorVideoTrack(track);
            }
            this._webcamTrack = track;
            this._replaceWebcamTrack();
        }
    }

    removeScreenshareStream(
        stream: MediaStream,
        { requestedByClientId }: RemoveScreenshareStreamOptions = { requestedByClientId: undefined },
    ) {
        logger.info("removeScreenshareStream() [streamId:%s, requestedByClientId:%s]", stream.id, requestedByClientId);

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

    addCameraStream(
        stream: MediaStream,
        { audioPaused, videoPaused, beforeEffectTracks = [] }: AddCameraStreamOptions = { beforeEffectTracks: [] },
    ) {
        this._micPaused = audioPaused;
        this._webcamPaused = videoPaused;

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
            this._sendWebcam(videoTrack);
            if (!trackAnnotations(videoTrack).isEffectTrack) {
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
            if (!trackAnnotations(audioTrack).isEffectTrack) {
                this._monitorAudioTrack(audioTrack);
            }
            const beforeEffectTrack = beforeEffectTracks.find((t) => t.kind === "audio");
            if (beforeEffectTrack) {
                this._monitorAudioTrack(beforeEffectTrack);
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

            // This is a hack
            this._webcamPaused = !enable;
            this._pauseResumeWebcam();

            this._handleStopOrResumeVideo({ enable, track });
        };

        stream.addEventListener("stopresumevideo", localStreamHandler);
        this._localStreamDeregisterFunction = () => {
            stream.removeEventListener("stopresumevideo", localStreamHandler);
        };
    }

    addScreenshareStream(stream: MediaStream) {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) this._sendScreenVideo(videoTrack);
        if (audioTrack) this._sendScreenAudio(audioTrack);

        this._emitScreenshareStarted();
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
     * The consuming app toggled the microphone.
     */
    stopOrResumeAudio({ enable }: { enable: boolean }) {
        logger.info("stopOrResumeAudio() [enable:%s]", enable);

        this._micPaused = !enable;

        this._pauseResumeMic();
    }

    _handleStopOrResumeVideo({ enable, track }: { enable: boolean; track: MediaStreamTrack }) {
        if (!enable) {
            if (this._webcamProducer && !this._webcamProducer.closed && this._webcamProducer.track === track) {
                this._stopProducer(this._webcamProducer);
                this._webcamProducer = null;
                this._webcamProducerOriginalSvcScalabilityMode = undefined;
                this._webcamProducerOriginalSvcMaxBitrate = undefined;
                this._webcamProducerHighestPreferredLayer = undefined;
                this._webcamTrack = null;
            }
        } else {
            this._sendWebcam(track);
        }
    }
    /**
     * Only for webcam. The consuming app toggled the webcam. Camera tracks arrive
     * through replaceTrack, whenever the app has one.
     */
    stopOrResumeVideo({ enable }: { enable: boolean }) {
        logger.info("stopOrResumeVideo() [enable:%s]", enable);

        this._webcamPaused = !enable;

        this._pauseResumeWebcam();
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

        // kept to apply to the stream's next consumer too, e.g. after an SFU reconnect
        this._streamIdToVideoResolution.set(streamId, { width, height });

        this._applyStreamResolution(streamId);
    }

    // asks the SFU for the layers fitting the stream's last requested resolution, if they changed
    _applyStreamResolution(streamId: string) {
        const resolution = this._streamIdToVideoResolution.get(streamId);
        const consumerId = this._streamIdToVideoConsumerId.get(streamId);
        const consumer = this._consumers.get(consumerId);

        if (!resolution || !consumer) return;
        const { width, height } = resolution;
        updateRenderedDimensions(consumer.track?.id, { width, height, time: Date.now() });

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
            const previousSpatialLayer = consumer.appData.spatialLayer;
            const spatialLayerChanged = previousSpatialLayer !== spatialLayer;

            if (spatialLayerChanged) {
                this.analytics.numPreferredSpatialLayerChanges++;
                this._incrementHistogramCount(
                    this.analytics.preferredSpatialLayerChangeCounts,
                    `${previousSpatialLayer}->${spatialLayer}`,
                );
            }

            consumer.appData.spatialLayer = spatialLayer;
            consumer.appData.temporalLayer = temporalLayer;

            this._vegaConnection?.message("setConsumersPreferredLayers", {
                consumerIds: [consumerId],
                spatialLayer,
                temporalLayer,
            });

            if (spatialLayerChanged) {
                this._watchForPreferredLayerSwitch(consumerId, consumer, {
                    toHigherLayer: spatialLayer > previousSpatialLayer,
                });
            }
        }
    }

    _watchForPreferredLayerSwitch(consumerId: string, consumer: any, { toHigherLayer }: { toHigherLayer: boolean }) {
        // a newer switch of an already watched consumer replaces its watch, even at the limit
        const previousWatch = this._preferredLayerSwitchWatches.get(consumerId);
        if (!previousWatch && this._preferredLayerSwitchWatches.size >= MAX_CONCURRENT_PREFERRED_LAYER_SWITCH_WATCHES) {
            return;
        }
        previousWatch?.stop();

        let stopped = false;
        let intervalId: ReturnType<typeof setInterval> | undefined;

        const stop = () => {
            if (stopped) return;
            stopped = true;
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            this._preferredLayerSwitchWatches.delete(consumerId);
        };

        this._preferredLayerSwitchWatches.set(consumerId, { stop });
        // started before the first getStats(), so a call that never settles can't keep the watch forever
        const timeoutId = setTimeout(stop, PREFERRED_LAYER_SWITCH_WATCH_TIMEOUT_MS);

        (async () => {
            const sentAt = Date.now();
            const baseline = await this._getConsumerFrameSize(consumer);

            // without a decoded frame there's no size to compare against: the first frame would look like the switch
            if (stopped || !baseline?.width || !baseline?.height) {
                stop();
                return;
            }

            let polling = false;
            intervalId = setInterval(async () => {
                if (stopped || consumer.closed) {
                    stop();
                    return;
                }
                // a slow getStats() (e.g. under CPU load) mustn't stack up overlapping calls
                if (polling) return;

                polling = true;
                const current = await this._getConsumerFrameSize(consumer);
                polling = false;
                if (stopped) return;
                // only a change in the requested direction counts, so an earlier switch that is still landing
                // (e.g. a quick 2->0->2) isn't mistaken for this one
                const switched = toHigherLayer
                    ? getFrameArea(current) > getFrameArea(baseline)
                    : getFrameArea(current) < getFrameArea(baseline);
                if (current && switched) {
                    this._recordPreferredLayerSwitchLatency(Date.now() - sentAt);
                    stop();
                }
            }, PREFERRED_LAYER_SWITCH_POLL_INTERVAL_MS);
        })();
    }

    async _getConsumerFrameSize(consumer: any): Promise<{ width?: number; height?: number } | undefined> {
        try {
            const stats = await consumer.getStats();
            let frameSize: { width?: number; height?: number } | undefined;

            stats.forEach((report: any) => {
                if (report.type === "inbound-rtp") {
                    frameSize = { width: report.frameWidth, height: report.frameHeight };
                }
            });

            return frameSize;
        } catch (error) {
            logger.warn("_getConsumerFrameSize() failed to read stats", { error });
            return undefined;
        }
    }

    _recordPreferredLayerSwitchLatency(latencyMs: number) {
        recordMetricSample(this._preferredLayerSwitchLatencyStats, latencyMs);

        const { avg } = aggregateMetricStats(this._preferredLayerSwitchLatencyStats);
        this.analytics.avgPreferredLayerSwitchLatencyMs = avg;
    }

    _onUpdatedStats(statsByView: Record<string, any>) {
        // the webcam's streams are found by its transceiver's mid: unlike the track id they're filed under, it doesn't
        // change when the track is replaced (outbound stats have no track id of their own)
        const webcamProducerMid = this._webcamProducer?.rtpParameters?.mid;
        if (webcamProducerMid === undefined) return;

        // a mid is only unique within one peer connection, and the stats cover every one on the page (e.g. the
        // bandwidth tester's), so the streams must also come from the send transport's. mediasoup keeps it internal,
        // so without it this falls back to the mid alone
        const sendTransportPc = (this._sendTransport as any)?.handler?._pc;
        const sendTransportPcIndex = sendTransportPc ? getPeerConnectionIndex(sendTransportPc) : undefined;

        const newRemoteReports: SsrcStats[] = [];

        Object.values(statsByView).forEach((viewStats: any) => {
            Object.values(viewStats.tracks || {}).forEach((trackStats: any) => {
                Object.entries(trackStats.ssrcs || {}).forEach(([ssrc, ssrcMetrics]: [string, any]) => {
                    if (ssrcMetrics.direction !== "out" || String(ssrcMetrics.mid) !== webcamProducerMid) return;
                    if (sendTransportPcIndex !== undefined && ssrcMetrics.pcIndex !== sendTransportPcIndex) return;

                    this._followCamOutboundCandidatePair(ssrcMetrics);

                    // an ssrc only has a remote report timestamp once the SFU has sent a report for it, and the
                    // stats poll repeats the last report's values until a new one arrives (forever for a paused
                    // layer), so only reports with a new timestamp are sampled
                    const { remoteReportTimestamp } = ssrcMetrics;
                    if (remoteReportTimestamp === undefined) return;
                    if (remoteReportTimestamp === this._lastSeenRemoteReportTimestamps.get(ssrc)) return;

                    this._lastSeenRemoteReportTimestamps.set(ssrc, remoteReportTimestamp);
                    newRemoteReports.push(ssrcMetrics);
                });
            });
        });

        if (!newRemoteReports.length) return;

        if (this._camOutboundSamplesToSkip > 0) {
            this._camOutboundSamplesToSkip--;
            return;
        }

        this._recordCamOutboundSample(newRemoteReports);
        this._updateCamOutboundAnalytics();
    }

    // one sample per stats poll with new reports: their highest round-trip time, as the simulcast layers share the
    // route and so its queueing, and their loss weighted by packets, as a low layer sends so few that one random loss
    // alone is several percent
    _recordCamOutboundSample(newRemoteReports: SsrcStats[]) {
        // 0 means the report had no round-trip time measurement yet
        const rttsMs = newRemoteReports.map(({ roundTripTime }) => (roundTripTime || 0) * 1000).filter((ms) => ms > 0);
        const rttMs = rttsMs.length ? Math.max(...rttsMs) : undefined;
        const fractionLost = getPacketWeightedFractionLost(newRemoteReports);

        const path = this._camOutboundPathRtt;
        if (rttMs !== undefined) {
            path.sumMs += rttMs;
            path.count++;
            path.minMs = Math.min(path.minMs ?? Infinity, rttMs);
        }

        // compared to the lowest round-trip time on this path so far, so congestion early on is judged against a
        // baseline that may still be too high
        const congested =
            (rttMs !== undefined && rttMs - (path.minMs ?? rttMs) > CONGESTED_RTT_INFLATION_MS) ||
            fractionLost > CONGESTED_FRACTION_LOST;

        this._camOutboundSamples.total++;
        if (congested) this._camOutboundSamples.congested++;
    }

    // a new selected candidate pair is a new network route (an ICE restart, a network switch, a fallback to TURN),
    // with its own lowest round-trip time
    _followCamOutboundCandidatePair({ selectedCandidatePairId }: SsrcStats) {
        if (!selectedCandidatePairId || selectedCandidatePairId === this._camOutboundCandidatePairId) return;

        if (this._camOutboundCandidatePairId !== undefined) {
            this._finishCamOutboundRttPath();
            this._camOutboundSamplesToSkip = CAM_SAMPLES_SKIPPED_AFTER_CANDIDATE_PAIR_CHANGE;
        }
        this._camOutboundCandidatePairId = selectedCandidatePairId;
    }

    // a new webcam producer (e.g. after a reconnect) or candidate pair may take another network path with its own
    // lowest round-trip time, so each path's time spent queued is measured against its own lowest
    _finishCamOutboundRttPath() {
        const path = this._camOutboundPathRtt;
        if (path.count && path.minMs !== undefined) {
            this._camOutboundRttInflation.sumMs += path.sumMs - path.count * path.minMs;
            this._camOutboundRttInflation.count += path.count;
        }
        this._camOutboundPathRtt = { sumMs: 0, count: 0, minMs: undefined };
    }

    _updateCamOutboundAnalytics() {
        // the lowest round-trip time is the path's own delay, anything above it is time spent queued on the way
        const path = this._camOutboundPathRtt;
        const inflationSumMs =
            this._camOutboundRttInflation.sumMs + (path.minMs !== undefined ? path.sumMs - path.count * path.minMs : 0);
        const inflationCount = this._camOutboundRttInflation.count + path.count;
        // the average over every sample of the session, the finished paths' and the current one's, so a path with
        // more samples weighs more, rather than an average of the paths' own averages
        this.analytics.camOutboundRttInflationMs = inflationCount
            ? Math.round(inflationSumMs / inflationCount)
            : undefined;

        const { congested, total } = this._camOutboundSamples;
        this.analytics.camOutboundCongestedFraction = total ? congested / total : undefined;
    }

    // stats are only used for our own webcam upload, so only collect them while it exists
    _startWebcamStatsSubscription() {
        if (this._statsSubscription) return;
        this._statsSubscription = subscribeStats({
            onUpdatedStats: (statsByView) => this._onUpdatedStats(statsByView),
        });
    }

    _stopWebcamStatsSubscription() {
        this._statsSubscription?.stop();
        this._statsSubscription = null;
        this._lastSeenRemoteReportTimestamps.clear();
        this._finishCamOutboundRttPath();
        this._camOutboundCandidatePairId = undefined;
        this._camOutboundSamplesToSkip = 0;
    }

    close() {
        this.disconnectAll();
    }

    disconnectAll() {
        this._reconnect = false;
        if (this._reconnectTimeOut) {
            clearTimeout(this._reconnectTimeOut);
            this._reconnectTimeOut = null;
        }

        // Temporary SFU-zombie telemetry: a leave with an offline still open never saw a real close,
        // so it's indistinguishable from a self-heal — don't bank it. Just reset and release the
        // listener.
        this._sfuZombieReset();
        window?.removeEventListener?.("offline", this._sfuZombie.onBrowserOffline); // browser-only

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
        this._streamIdToVideoResolution.clear();

        this._mediasoupDeviceInitializedAsync = Promise.resolve(null);
        this._qualityMonitor.close();
        this._stopWebcamStatsSubscription();
        this._preferredLayerSwitchWatches.forEach(({ stop }) => stop());
    }

    sendStatsCustomEvent(eventName: string, data?: any) {
        rtcStats.sendEvent(eventName, data);
    }

    rtcStatsConnect() {
        if (!rtcStats.server.connected) {
            rtcStats.server.connect();
        }
    }

    rtcStatsDisconnect() {
        rtcStats.server.close();
    }

    rtcStatsReconnect() {
        if (!rtcStats.server.connected && rtcStats.server.attemptedConnectedAtLeastOnce) {
            rtcStats.server.connect();
        }
    }

    _monitorAudioTrack(track: any) {
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
                    case "changedHighestPreferredLayer":
                        return this._onChangedHighestPreferredLayer(data);
                    default:
                        logger.info(`unknown message method "${method}"`);
                        return;
                }
            })
            .catch((error) => {
                logger.error('"message" failed [error:%o]', error);
            });
    }

    async _onConsumerReady(options: ConsumerOptions<ConsumerAppData>) {
        logger.info("_onConsumerReady()", { id: options.id, producerId: options.producerId });

        let consumer;

        try {
            if (!this._receiveTransport) {
                throw new Error("No receive transport when attempting to create consumer");
            }
            consumer = await this._receiveTransport.consume(options);
        } catch (error) {
            this.analytics.vegaConsumerCreationFailed++;
            rtcStats.sendEvent("VegaConsumerCreationFailed", { producerId: options.producerId, error });
            throw error;
        }

        consumer.pause();
        consumer.appData.localPaused = true;
        // the layer a new consumer is assumed to start at. The temporal layer is left unset, so the first
        // updateStreamResolution() always sends its preferred layers
        consumer.appData.spatialLayer = INITIAL_CONSUMER_SPATIAL_LAYER;

        this._consumers.set(consumer.id, consumer);
        this._qualityMonitor.addConsumer(consumer.appData.sourceClientId, consumer.id);
        consumer.observer.once("close", () => {
            this._consumers.delete(consumer.id);
            this._qualityMonitor.removeConsumer(consumer.appData.sourceClientId, consumer.id);

            this._consumerClosedCleanup(consumer);

            // not while the whole receive transport is closing, e.g. on an SFU reconnect
            if (consumer.kind === "video" && this._receiveTransport && !this._receiveTransport.closed) {
                this._reapplyStreamResolutions();
            }
        });

        if (this._features.increaseIncomingMediaBufferOn && consumer.rtpReceiver) {
            try {
                consumer.rtpReceiver.jitterBufferTarget = MEDIA_JITTER_BUFFER_TARGET;
                // @ts-ignore Legacy Chrome API
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

        // includes this consumer's own stream, e.g. while the consumers are recreated after an SFU reconnect
        this._reapplyStreamResolutions();
    }

    // the layers depend on the number of active videos, and the app only updates a stream's resolution when its tile
    // changes size, so re-apply every stream's whenever that number may have changed. Unchanged layers aren't resent
    _reapplyStreamResolutions() {
        this._streamIdToVideoResolution.forEach((_resolution, streamId) => this._applyStreamResolution(streamId));
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

        if (consumer.kind === "video") this._reapplyStreamResolutions();
    }

    _onConsumerResumed({ consumerId }: { consumerId: string }) {
        logger.info("_onConsumerResumed()", { consumerId });

        const consumer = this._consumers.get(consumerId);

        if (!consumer) return;

        consumer.appData.remotePaused = false;

        if (!consumer.appData.localPaused) {
            consumer.resume();
        }

        if (consumer.kind === "video") this._reapplyStreamResolutions();
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

    // the SVC encoding params for `spatialLayer`, or undefined when the encoding already has them
    _getSvcEncodingUpdate(encoding: RtpEncodingParametersWithScalabilityMode, spatialLayer: number) {
        const reduced = getReducedSvcEncodingParams(
            this._webcamProducerOriginalSvcScalabilityMode,
            spatialLayer,
            this._webcamProducerOriginalSvcMaxBitrate,
        );
        if (!reduced) return undefined;

        const changed =
            reduced.scalabilityMode !== encoding.scalabilityMode ||
            reduced.scaleResolutionDownBy !== (encoding.scaleResolutionDownBy ?? 1) ||
            reduced.maxBitrate !== encoding.maxBitrate;
        return changed ? reduced : undefined;
    }

    async _onChangedHighestPreferredLayer({ producerId, spatialLayer }: { producerId: string; spatialLayer: number }) {
        if (!this._features.sfuHighestPreferredLayerTrackingOn) return;

        if (this._webcamProducer?.id !== producerId) return;

        // a missing/NaN layer would fail every `index <= spatialLayer` check and deactivate all simulcast encodings
        if (!Number.isFinite(spatialLayer)) {
            logger.warn("_onChangedHighestPreferredLayer() ignoring invalid spatialLayer", {
                producerId,
                spatialLayer,
            });
            return;
        }

        if (
            this._webcamProducerHighestPreferredLayer !== undefined &&
            this._webcamProducerHighestPreferredLayer !== spatialLayer
        ) {
            this.analytics.numHighestPreferredLayerChanges++;
            this._incrementHistogramCount(
                this.analytics.highestPreferredLayerChangeCounts,
                `${this._webcamProducerHighestPreferredLayer}->${spatialLayer}`,
            );
        }
        this._webcamProducerHighestPreferredLayer = spatialLayer;

        logger.info("_onChangedHighestPreferredLayer()", { producerId, spatialLayer });

        return this._syncWebcamEncoderToHighestPreferredLayer();
    }

    _syncWebcamEncoderToHighestPreferredLayer() {
        // An update already in flight re-applies the latest state once its encoder update settles
        this._highestPreferredLayerUpdatePending = true;
        if (!this._highestPreferredLayerUpdate) {
            this._highestPreferredLayerUpdate = this._applyPendingHighestPreferredLayerUpdates();
        }
        return this._highestPreferredLayerUpdate;
    }

    async _applyPendingHighestPreferredLayerUpdates() {
        while (this._highestPreferredLayerUpdatePending) {
            this._highestPreferredLayerUpdatePending = false;
            try {
                await this._applyHighestPreferredLayerToWebcamEncoder();
            } catch (error) {
                logger.error("Failed to apply highest preferred layer: %o", error);
            }
        }
        this._highestPreferredLayerUpdate = null;
    }

    // goes through mediasoup rather than rtpSender.setParameters(), so the remote SDP keeps matching the active
    // layers (a renegotiation would otherwise re-activate them) and it's serialized with other transport operations
    async _applyHighestPreferredLayerToWebcamEncoder() {
        const producer = this._webcamProducer;
        const highestPreferredLayer = this._webcamProducerHighestPreferredLayer;
        if (!producer || highestPreferredLayer === undefined) return;

        const encodings: RtpEncodingParametersWithScalabilityMode[] = producer.rtpSender.getParameters().encodings;

        if (encodings.length > 1) {
            const cpuOveruseLimit = this._cpuOveruseDetected && encodings.length === 3 ? 1 : Infinity;
            const spatialLayer = Math.max(0, Math.min(highestPreferredLayer, cpuOveruseLimit, encodings.length - 1));

            if (producer.maxSpatialLayer === spatialLayer) return;

            await producer.setMaxSpatialLayer(spatialLayer);

            // mediasoup swallows a failed update and records the layer as applied anyway, so at least surface it
            const applied = producer.rtpSender
                .getParameters()
                .encodings.every(
                    (encoding: RTCRtpEncodingParameters, index: number) => encoding.active === index <= spatialLayer,
                );
            if (!applied) logger.error("setMaxSpatialLayer(%d) was not applied to the encodings", spatialLayer);
        } else if (encodings.length === 1 && this._webcamProducerOriginalSvcScalabilityMode) {
            const update = this._getSvcEncodingUpdate(encodings[0], highestPreferredLayer);

            if (update) await producer.setRtpEncodingParameters(update);
        }
    }

    _incrementHistogramCount(histogram: Record<string, number>, key: string) {
        histogram[key] = (histogram[key] || 0) + 1;
    }

    async _onDataConsumerReady(options: DataConsumerOptions<DataConsumerAppData>) {
        logger.info("_onDataConsumerReady()", { id: options.id, dataProducerId: options.dataProducerId });

        if (!this._receiveTransport) {
            throw new Error("No receive transport when attempting to create data consumer");
        }

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

    _consumerClosedCleanup(consumer: Consumer<ConsumerAppData>) {
        const { sourceClientId: clientId, screenShare } = consumer.appData;
        const clientState = this._getOrCreateClientState(clientId);
        const stream = screenShare ? clientState.screenStream : clientState.webcamStream;

        if (!stream) return;

        stream.removeTrack(consumer.track);

        if (stream.getTracks().length === 0) {
            this._streamIdToVideoConsumerId.delete(stream.id);

            // We need to clean up our clientState
            // TODO: @geirbakke investigate missing mic audio if screenshare starts during reconnect
            if (screenShare) {
                // a new screenshare gets a new stream, so its resolution won't be needed again
                this._streamIdToVideoResolution.delete(stream.id);
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

        if (toPauseConsumers.length > 0 || toResumeConsumers.length > 0) this._reapplyStreamResolutions();

        // If the webcam stream has not been emitted, we emit it.
        if (webcamStream && !hasEmittedWebcamStream && hasAcceptedWebcamStream) {
            this._emitToPWA(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                clientId,
                stream: webcamStream,
                streamId: camStreamId,
                streamType: STREAM_TYPES.webcam,
            });

            clientState.hasEmittedWebcamStream = true;
        }

        // If the screen stream has not been emitted, we emit it.
        if (screenStream && !hasEmittedScreenStream && hasAcceptedScreenStream) {
            this._emitToPWA(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                clientId,
                stream: screenStream,
                streamId: screenShareStreamId,
                streamType: STREAM_TYPES.screenshare,
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

    // For SFU we accept streams from both sides (in contrast with current P2P manager)
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
