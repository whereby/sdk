import { RtpCapabilities } from "@whereby.com/mediasoup-client/lib/RtpParameters";
import { SctpParameters } from "@whereby.com/mediasoup-client/lib/SctpParameters";
import { DtlsParameters, IceCandidate, IceParameters } from "@whereby.com/mediasoup-client/lib/Transport";

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

type VegaAnalytics = {
    vegaUnknownResponse: number;
    vegaRequestTimeout: number;
    vegaJoinFailed: number;
    vegaJoinWithoutVegaConnection: number;
    vegaCreateTransportWithoutVegaConnection: number;
    vegaIceRestarts: number;
    vegaIceRestartMissingTransport: number;
    vegaIceRestartWrongTransportId: number;
    vegaNonErrorRejectionValueGUMError: number;
    vegaReplaceTrackNoProducerNoEnabledTrack: number;
    vegaMicProducerFailed: number;
    vegaWebcamProducerFailed: number;
    vegaScreenVideoProducerFailed: number;
    vegaScreenAudioProducerFailed: number;
    vegaConsumerCreationFailed: number;
    micTrackEndedCount: number;
    camTrackEndedCount: number;
    numNewPc: number;
    numIceConnected: number;
    numIceDisconnected: number;
    numIceFailed: number;
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
