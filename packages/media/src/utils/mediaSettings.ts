const AUDIO_SETTINGS = {
    codecOptions: {
        opusDtx: true,
        opusFec: true,
    },
    encodings: [{ dtx: true }],
};

const VIDEO_SETTINGS_HD = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [
        { scaleResolutionDownBy: 4, maxBitrate: 150000 },
        { scaleResolutionDownBy: 2, maxBitrate: 500000 },
        { scaleResolutionDownBy: 1, maxBitrate: 1000000 },
    ],
};

const VIDEO_SETTINGS_SD = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [
        { scaleResolutionDownBy: 2, maxBitrate: 150000 },
        { scaleResolutionDownBy: 1, maxBitrate: 500000 },
    ],
};

const VIDEO_SETTINGS_VP9 = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [{ scalabilityMode: "L3T2_KEY" }],
};

const VIDEO_SETTINGS_VP9_LOW_BANDWIDTH = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [{ scalabilityMode: "L2T2_KEY", maxBitrate: 800000 }],
};

const SCREEN_SHARE_SETTINGS = {
    encodings: [{}],
};

const SCREEN_SHARE_SETTINGS_LOW_BANDWIDTH = {
    encodings: [
        {
            maxBitrate: 600000,
            maxFramerate: 2,
        },
    ],
};

const SCREEN_SHARE_SIMULCAST_SETTINGS = {
    encodings: [
        { scaleResolutionDownBy: 2, dtx: true, maxBitrate: 500000 },
        { scaleResolutionDownBy: 1, dtx: true, maxBitrate: 1500000 },
    ],
};

const SCREEN_SHARE_SETTINGS_VP9 = {
    encodings: [{ dtx: true }],
};

export const getMediaSettings = (kind: string, isScreenShare: boolean, features: { lowDataModeEnabled?: boolean, simulcastScreenshareOn?: boolean, lowBandwidth?: boolean, vp9On?: boolean }) => {
    const { lowDataModeEnabled, simulcastScreenshareOn, lowBandwidth, vp9On } = features;

    if (kind === "audio") {
        return AUDIO_SETTINGS;
    }

    if (isScreenShare) {
        if (lowBandwidth && !vp9On) return SCREEN_SHARE_SETTINGS_LOW_BANDWIDTH;
        if (vp9On) return SCREEN_SHARE_SETTINGS_VP9;
        if (simulcastScreenshareOn) return SCREEN_SHARE_SIMULCAST_SETTINGS;

        return SCREEN_SHARE_SETTINGS;
    } else {
        if (lowBandwidth) {
            if (vp9On) return VIDEO_SETTINGS_VP9_LOW_BANDWIDTH;
            return VIDEO_SETTINGS_SD;
        }
        if (vp9On) return VIDEO_SETTINGS_VP9;
        if (lowDataModeEnabled) return VIDEO_SETTINGS_SD;

        return VIDEO_SETTINGS_HD;
    }
};

export const modifyMediaCapabilities = (routerRtpCapabilities: any, features: { vp9On?: boolean , h264On?: boolean }) => {
    const { vp9On, h264On } = features;

    if (vp9On) {
        const { preferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec: any) => codec.mimeType.toLowerCase() === "video/vp9"
        );

        const { preferredPayloadType: aptPreferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec: any) =>
                codec.mimeType.toLowerCase() === "video/rtx" && codec.parameters.apt === preferredPayloadType
        );

        routerRtpCapabilities.codecs = routerRtpCapabilities.codecs.filter(
            (codec: any) =>
                codec.kind === "audio" ||
                codec.preferredPayloadType === preferredPayloadType ||
                codec.preferredPayloadType === aptPreferredPayloadType
        );
    } else if (h264On) {
        const { preferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec: any) => codec.mimeType.toLowerCase() === "video/h264"
        );

        const { preferredPayloadType: aptPreferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec: any) =>
                codec.mimeType.toLowerCase() === "video/rtx" && codec.parameters.apt === preferredPayloadType
        );

        routerRtpCapabilities.codecs = routerRtpCapabilities.codecs.filter(
            (codec: any) =>
                codec.kind === "audio" ||
                codec.preferredPayloadType === preferredPayloadType ||
                codec.preferredPayloadType === aptPreferredPayloadType
        );
    }
};

function getPreferredOrder(availableCodecs: string[], { vp9On, av1On }: { vp9On?: boolean, av1On?: boolean }) {
    if (vp9On) {
        availableCodecs.unshift("video/vp9")
    }

    if (av1On) {
        availableCodecs.unshift("video/av1")
    }
    return availableCodecs
}

export interface Codec { clockRate: number; mimeType: string; sdpFmtpLine?: string }

export function sortCodecsByMimeType(
    codecs: Codec[],
    features: { vp9On?: boolean, av1On?: boolean }
) {
    const availableCodecs = codecs.map(({ mimeType }) => mimeType).filter((value, index, array) => array.indexOf(value) === index)
    const preferredOrder = getPreferredOrder(availableCodecs, features)
    return codecs.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a.mimeType.toLowerCase());
        const indexB = preferredOrder.indexOf(b.mimeType.toLowerCase());
        const orderA = indexA >= 0 ? indexA : Number.MAX_VALUE;
        const orderB = indexB >= 0 ? indexB : Number.MAX_VALUE;
        return orderA - orderB;
    });
}
