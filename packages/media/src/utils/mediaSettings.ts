import { RtpCapabilities, RtpCodecCapability } from "mediasoup-client/lib/RtpParameters";
import adapter from "webrtc-adapter";

export const AUDIO_SETTINGS = {
    codecOptions: {
        opusDtx: true,
        opusFec: true,
    },
    encodings: [{ dtx: true }],
};

export const VIDEO_SETTINGS_HD = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [
        { scaleResolutionDownBy: 4, maxBitrate: 150000 },
        { scaleResolutionDownBy: 2, maxBitrate: 500000 },
        { scaleResolutionDownBy: 1, maxBitrate: 1000000 },
    ],
};

export const VIDEO_SETTINGS_SD = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [
        { scaleResolutionDownBy: 2, maxBitrate: 150000 },
        { scaleResolutionDownBy: 1, maxBitrate: 500000 },
    ],
};

export const VIDEO_SETTINGS_VP9 = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [{ scalabilityMode: "L3T2", maxBitrate: 1000000 }],
};

export const VIDEO_SETTINGS_VP9_KEY = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [{ scalabilityMode: "L3T2_KEY", maxBitrate: 1250000 }],
};

export const VIDEO_SETTINGS_VP9_LOW_BANDWIDTH = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [{ scalabilityMode: "L2T2", maxBitrate: 500000 }],
};

export const VIDEO_SETTINGS_VP9_LOW_BANDWIDTH_KEY = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [{ scalabilityMode: "L2T2_KEY", maxBitrate: 650000 }],
};

export const SCREEN_SHARE_SETTINGS = {
    encodings: [{}],
};

export const SCREEN_SHARE_SIMULCAST_SETTINGS = {
    encodings: [
        { scaleResolutionDownBy: 2, dtx: true, maxBitrate: 500000 },
        { scaleResolutionDownBy: 1, dtx: true, maxBitrate: 1500000 },
    ],
};

export const ADDITIONAL_SCREEN_SHARE_SETTINGS = {
    encodings: [
        { scaleResolutionDownBy: 4, dtx: true, maxBitrate: 150000 },
        { scaleResolutionDownBy: 2, dtx: true, maxBitrate: 500000 },
        { scaleResolutionDownBy: 1, dtx: true, maxBitrate: 1500000 },
    ],
};

export const ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9 = {
    encodings: [{ scalabilityMode: "L2T2_KEY", dtx: true, maxBitrate: 1500000 }],
};

export const SCREEN_SHARE_SETTINGS_VP9 = {
    encodings: [{ dtx: true }],
};

export const getMediaSettings = (
    kind: string,
    isScreenShare: boolean,
    features: {
        lowDataModeEnabled?: boolean;
        simulcastScreenshareOn?: boolean;
        vp9On?: boolean;
        svcKeyScalabilityModeOn?: boolean;
    },
    isSomeoneAlreadyPresenting = false,
) => {
    const { lowDataModeEnabled, simulcastScreenshareOn, vp9On, svcKeyScalabilityModeOn } = features;

    if (kind === "audio") {
        return AUDIO_SETTINGS;
    }
    const isChrome = adapter.browserDetails.browser === "chrome";

    const isVp9Available = isChrome && vp9On;
    if (isScreenShare) {
        return getScreenShareMediaSettings({
            isVp9Available,
            isSomeoneAlreadyPresenting,
            simulcastScreenshareOn,
        });
    } else {
        return getCameraMediaSettings({
            lowBandwidth: lowDataModeEnabled,
            isVp9Available,
            svcKeyScalabilityModeOn,
        });
    }
};

const getCameraMediaSettings = ({
    lowBandwidth,
    isVp9Available,
    svcKeyScalabilityModeOn,
}: {
    lowBandwidth?: boolean;
    isVp9Available?: boolean;
    svcKeyScalabilityModeOn?: boolean;
}) => {
    if (lowBandwidth) {
        if (isVp9Available) {
            if (svcKeyScalabilityModeOn) return VIDEO_SETTINGS_VP9_LOW_BANDWIDTH_KEY;
            return VIDEO_SETTINGS_VP9_LOW_BANDWIDTH;
        }
        return VIDEO_SETTINGS_SD;
    }
    if (isVp9Available) {
        if (svcKeyScalabilityModeOn) return VIDEO_SETTINGS_VP9_KEY;
        return VIDEO_SETTINGS_VP9;
    }

    return VIDEO_SETTINGS_HD;
};

const getScreenShareMediaSettings = ({
    isVp9Available,
    isSomeoneAlreadyPresenting,
    simulcastScreenshareOn,
}: {
    isVp9Available?: boolean;
    isSomeoneAlreadyPresenting?: boolean;
    simulcastScreenshareOn?: boolean;
}) => {
    if (isSomeoneAlreadyPresenting) {
        if (isVp9Available) return ADDITIONAL_SCREEN_SHARE_SETTINGS_VP9;
        return ADDITIONAL_SCREEN_SHARE_SETTINGS;
    }
    if (isVp9Available) return SCREEN_SHARE_SETTINGS_VP9;
    if (simulcastScreenshareOn) return SCREEN_SHARE_SIMULCAST_SETTINGS;

    return SCREEN_SHARE_SETTINGS;
};

enum PrioritizableCodec {
    H264 = "video/h264",
    VP9 = "video/vp9",
}
export const modifyMediaCapabilities = (
    routerRtpCapabilities: RtpCapabilities,
    features: { vp9On?: boolean; h264On?: boolean },
) => {
    const { vp9On, h264On } = features;
    const isChrome = adapter.browserDetails.browser === "chrome";
    if (!routerRtpCapabilities?.codecs) {
        return routerRtpCapabilities;
    }

    if (vp9On && isChrome) {
        const sorted = prioritizeRouterRtpCapabilitiesCodecs(routerRtpCapabilities.codecs, PrioritizableCodec.VP9);
        return { ...routerRtpCapabilities, codecs: sorted };
    } else if (h264On) {
        const sorted = prioritizeRouterRtpCapabilitiesCodecs(routerRtpCapabilities.codecs, PrioritizableCodec.H264);
        return { ...routerRtpCapabilities, codecs: sorted };
    }

    return routerRtpCapabilities;
};

function prioritizeRouterRtpCapabilitiesCodecs(codecs: RtpCodecCapability[], preferredCodec: PrioritizableCodec) {
    const preferredCodecEntry = codecs.find(({ mimeType }) => mimeType.toLowerCase() === preferredCodec);
    if (!preferredCodecEntry) {
        return codecs;
    }
    return [...codecs].sort((left, right) => {
        if (left.mimeType.toLowerCase() === preferredCodec) {
            return -1;
        }
        if (
            left.mimeType.toLowerCase() === "video/rtx" &&
            left.parameters.apt === preferredCodecEntry.preferredPayloadType
        ) {
            if (right.mimeType.toLowerCase() === preferredCodec) {
                return 1;
            }
            return -1;
        }
        return 0;
    });
}

function getPreferredOrder(availableCodecs: string[], { vp9On, av1On }: { vp9On?: boolean; av1On?: boolean }) {
    if (vp9On) {
        availableCodecs.unshift("video/vp9");
    }

    if (av1On) {
        availableCodecs.unshift("video/av1");
    }
    return availableCodecs;
}

export interface Codec {
    clockRate: number;
    mimeType: string;
    sdpFmtpLine?: string;
}

function sortCodecsByMimeType(codecs: Codec[], features: { vp9On?: boolean; av1On?: boolean }) {
    const availableCodecs = codecs
        .map(({ mimeType }) => mimeType)
        .filter((value, index, array) => array.indexOf(value) === index);
    const preferredOrder = getPreferredOrder(availableCodecs, features);
    return codecs.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a.mimeType.toLowerCase());
        const indexB = preferredOrder.indexOf(b.mimeType.toLowerCase());
        const orderA = indexA >= 0 ? indexA : Number.MAX_VALUE;
        const orderB = indexB >= 0 ? indexB : Number.MAX_VALUE;
        return orderA - orderB;
    });
}

async function getIsCodecDecodingPowerEfficient(codec: string) {
    const { powerEfficient } = await navigator.mediaCapabilities.decodingInfo({
        type: "webrtc",
        video: {
            width: 1280,
            height: 720,
            bitrate: 2580,
            framerate: 24,
            contentType: codec,
        },
    });
    return powerEfficient;
}

async function sortCodecsByPowerEfficiency(codecs: Codec[]) {
    const codecPowerEfficiencyEntries: [string, boolean][] = await Promise.all(
        codecs.map(({ mimeType }) =>
            getIsCodecDecodingPowerEfficient(mimeType).then((val): [string, boolean] => [mimeType, val]),
        ),
    );
    const codecPowerEfficiencies = Object.fromEntries(codecPowerEfficiencyEntries);

    const sorted = codecs.sort((a, b) => {
        const aPowerEfficient = codecPowerEfficiencies[a.mimeType];
        const bPowerEfficient = codecPowerEfficiencies[b.mimeType];
        return aPowerEfficient === bPowerEfficient ? 0 : aPowerEfficient ? -1 : 1;
    });

    return sorted;
}

export async function sortCodecs(
    codecs: Codec[],
    features: { vp9On?: boolean; av1On?: boolean; preferHardwareDecodingOn?: boolean },
) {
    codecs = sortCodecsByMimeType(codecs, features);
    if (features.preferHardwareDecodingOn) {
        codecs = await sortCodecsByPowerEfficiency(codecs);
    }

    return codecs;
}
