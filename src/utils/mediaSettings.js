const AUDIO_SETTINGS = {
    codecOptions: {
        opusDtx: true,
        opusFec: true,
    },
    encodings: [{ dtx: true, networkPriority: "high" }],
};

const VIDEO_SETTINGS_HD = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [
        { scaleResolutionDownBy: 4, maxBitrate: 150000, networkPriority: "high" },
        { scaleResolutionDownBy: 2, maxBitrate: 500000 },
        { scaleResolutionDownBy: 1, maxBitrate: 1000000 },
    ],
};

const VIDEO_SETTINGS_SD = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [
        { scaleResolutionDownBy: 2, maxBitrate: 150000, networkPriority: "high" },
        { scaleResolutionDownBy: 1, maxBitrate: 500000 },
    ],
};

const VIDEO_SETTINGS_VP9 = {
    codecOptions: {
        videoGoogleStartBitrate: 500,
    },
    encodings: [{ scalabilityMode: "L3T2_KEY", networkPriority: "high" }],
};

const SCREEN_SHARE_SETTINGS = {
    encodings: [{ networkPriority: "medium" }],
};

const SCREEN_SHARE_SIMULCAST_SETTINGS = {
    encodings: [
        { scaleResolutionDownBy: 2, dtx: true, maxBitrate: 500000 },
        { scaleResolutionDownBy: 1, dtx: true, maxBitrate: 1500000 },
    ],
};

const SCREEN_SHARE_SETTINGS_VP9 = {
    encodings: [{ scalabilityMode: "L1T1", dtx: true, networkPriority: "high" }],
};

export const getMediaSettings = (kind, isScreenShare, features) => {
    const { lowDataModeEnabled, simulcastScreenshareOn, vp9On } = features;

    if (kind === "audio") {
        return AUDIO_SETTINGS;
    }

    if (isScreenShare) {
        if (vp9On) return SCREEN_SHARE_SETTINGS_VP9;
        if (simulcastScreenshareOn) return SCREEN_SHARE_SIMULCAST_SETTINGS;

        return SCREEN_SHARE_SETTINGS;
    } else {
        if (vp9On) return VIDEO_SETTINGS_VP9;
        if (lowDataModeEnabled) return VIDEO_SETTINGS_SD;

        return VIDEO_SETTINGS_HD;
    }
};

export const modifyMediaCapabilities = (routerRtpCapabilities, features) => {
    const { vp9On, h264On } = features;

    if (vp9On) {
        const { preferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec) => codec.mimeType.toLowerCase() === "video/vp9"
        );

        const { preferredPayloadType: aptPreferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec) => codec.mimeType.toLowerCase() === "video/rtx" && codec.parameters.apt === preferredPayloadType
        );

        routerRtpCapabilities.codecs = routerRtpCapabilities.codecs.filter(
            (codec) =>
                codec.kind === "audio" ||
                codec.preferredPayloadType === preferredPayloadType ||
                codec.preferredPayloadType === aptPreferredPayloadType
        );
    } else if (h264On) {
        const { preferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec) => codec.mimeType.toLowerCase() === "video/h264"
        );

        const { preferredPayloadType: aptPreferredPayloadType } = routerRtpCapabilities.codecs.find(
            (codec) => codec.mimeType.toLowerCase() === "video/rtx" && codec.parameters.apt === preferredPayloadType
        );

        routerRtpCapabilities.codecs = routerRtpCapabilities.codecs.filter(
            (codec) =>
                codec.kind === "audio" ||
                codec.preferredPayloadType === preferredPayloadType ||
                codec.preferredPayloadType === aptPreferredPayloadType
        );
    }
};
