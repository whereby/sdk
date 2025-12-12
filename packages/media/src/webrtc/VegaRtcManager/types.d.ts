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

type VegaAnalytics = {
    vegaJoinFailed: number;
    vegaJoinWithoutVegaConnection: number;
    vegaCreateTransportWithoutVegaConnection: number;
    vegaIceRestarts: number;
    vegaIceRestartMissingTransport: number;
    vegaIceRestartWrongTransportId: number;
};

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
