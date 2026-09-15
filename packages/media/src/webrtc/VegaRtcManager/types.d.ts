import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { SctpParameters } from "mediasoup-client/lib/SctpParameters";
import { DtlsParameters, IceCandidate, IceParameters } from "mediasoup-client/lib/Transport";

type VegaGetCapabilitiesResponse = {
    routerRtpCapabilities: RtpCapabilities;
    audioSettings: any; // Used by iOS app/SDK
    videoSettings: any; // Used by iOS app/SDK
};

type VegaCreateTransportResponse = {
    id: string;
    iceParameters: IceParameters;
    iceCandidates: [IceCandidate];
    dtlsParameters: DtlsParameters;
    sctpParameters: SctpParameters;
};

type VegaRestartIceResponse = {
    iceParameters: IceParameters;
};

type VegaProduceResponse = {
    id: string;
};

type VegaProduceDataResponse = {
    id: string;
};

type VegaTransportDirection = "send" | "recv";

type TransportAppData = {
    localClosed: boolean;
    iceRestartStarted?: number;
};

type VegaMediaSourceType = "mic" | "webcam" | "screenvideo" | "screenaudio";

type ProducerAppData = {
    paused: boolean;
    // localClosed is updated locally, SFU and corresponding consumers do not know about the property.
    localClosed?: boolean;
    streamId: string;
    screenShare: boolean;
    source: VegaMediaSourceType;
    sourceClientId: string;
};

type DataProducerAppData = {
    producerId: string;
    clientId: string;
    localClosed?: boolean;
};

type ConsumerAppData = {
    sourceClientId: string;
    screenShare: boolean;
    streamId: string;
    paused: boolean;
    localPaused: boolean;
    localClosed: boolean;
    spatialLayer: number;
    temporalLayer?: number;
    source: VegaMediaSourceType;
    screenshare: boolean;
    colocation?: string;
};

type DataConsumerAppData = {
    clientId: string;
    producerId: string;
    colocation?: string;
    localClosed: boolean;
};

type VegaAnalytics = {
    vegaUnknownResponse: number;
    vegaRequestTimeout: number;
    vegaJoinFailed: number;
    vegaJoinWithoutVegaConnection: number;
    vegaCreateTransportWithoutVegaConnection: number;
    vegaIceRestarts: number;
    vegaIceRestartMissingTransport: number;
    vegaIceRestartWrongTransportId: number;
    vegaReplaceTrackNoProducerNoEnabledTrack: number;
    vegaMicProducerFailed: number;
    vegaWebcamProducerFailed: number;
    vegaScreenVideoProducerFailed: number;
    vegaScreenAudioProducerFailed: number;
    vegaConsumerCreationFailed: number;
    vegaMicProducerClosed: number;
    micTrackEndedCount: number;
    camTrackEndedCount: number;
    numNewPc: number;
    numIceConnected: number;
    numIceDisconnected: number;
    numIceFailed: number;
    sfuMsFromOfflineToClose: number;
    sfuOfflineWhileConnectedCount: number;
    sfuOfflineToCloseCount: number;
    numPreferredSpatialLayerChanges: number;
    preferredSpatialLayerChangeCounts: Record<string, number>;
    numHighestRequiredLayerChanges: number;
    highestRequiredLayerChangeCounts: Record<string, number>;
    numPreferredLayerSwitchLatencySamples: number;
    minPreferredLayerSwitchLatencyMs: number | undefined;
    maxPreferredLayerSwitchLatencyMs: number | undefined;
    avgPreferredLayerSwitchLatencyMs: number | undefined;
    p95PreferredLayerSwitchLatencyMs: number | undefined;
    p99PreferredLayerSwitchLatencyMs: number | undefined;
    totalBytesSent: number;
    totalBytesReceived: number;
    totalPacketsLostInbound: number;
    totalPacketsLostOutbound: number;
    numInboundJitterSamples: number;
    minInboundJitterMs: number | undefined;
    maxInboundJitterMs: number | undefined;
    avgInboundJitterMs: number | undefined;
    p95InboundJitterMs: number | undefined;
    p99InboundJitterMs: number | undefined;
    numOutboundJitterSamples: number;
    minOutboundJitterMs: number | undefined;
    maxOutboundJitterMs: number | undefined;
    avgOutboundJitterMs: number | undefined;
    p95OutboundJitterMs: number | undefined;
    p99OutboundJitterMs: number | undefined;
};

type VegaAnalyticMetric = {
    [K in keyof VegaAnalytics]: VegaAnalytics[K] extends number ? K : never;
}[keyof VegaAnalytics];

export type VegaIncrementAnalyticMetric = (metric: VegaAnalyticMetric) => void;

type MediaStreamWhichMayHaveInboundId = MediaStream & { inboundId?: string };

type ClientState = {
    hasAcceptedWebcamStream: Boolean;
    hasAcceptedScreenStream: Boolean;
    hasEmittedWebcamStream: Boolean;
    hasEmittedScreenStream: Boolean;
    webcamStream?: MediaStreamWhichMayHaveInboundId;
    screenStream?: MediaStreamWhichMayHaveInboundId;
    screenShareStreamId?: string;
    camStreamId?: string;
};
