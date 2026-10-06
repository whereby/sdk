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
    camTrackEndedCount: number;
    micTrackEndedCount: number;
    numIceConnected: number;
    numIceDisconnected: number;
    numIceFailed: number;
    numNewPc: number;
    sfuMsFromOfflineToClose: number;
    sfuOfflineToCloseCount: number;
    sfuOfflineWhileConnectedCount: number;
    vegaConsumerCreationFailed: number;
    vegaCreateTransportWithoutVegaConnection: number;
    vegaIceRestartMissingTransport: number;
    vegaIceRestarts: number;
    vegaIceRestartWrongTransportId: number;
    vegaJoinFailed: number;
    vegaJoinWithoutVegaConnection: number;
    vegaMicProducerClosed: number;
    vegaMicProducerFailed: number;
    vegaReplaceTrackNoProducerNoEnabledTrack: number;
    vegaRequestTimeout: number;
    vegaScreenAudioProducerFailed: number;
    vegaScreenVideoProducerFailed: number;
    vegaUnknownResponse: number;
    vegaWebcamProducerFailed: number;
};

type VegaAnalyticMetric = keyof VegaAnalytics;

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
