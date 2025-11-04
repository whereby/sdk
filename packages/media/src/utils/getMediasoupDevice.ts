import { detectDeviceAsync, Device } from "mediasoup-client";
import { BuiltinHandlerName } from "mediasoup-client/lib/types";
import { Safari17 } from "../webrtc/VegaRtcManager/Safari17Handler";

type SupportedDevice = BuiltinHandlerName | "NodeJS" | "Safari17" | undefined;
const SAFARI_17_REGEXP = new RegExp(
    /^(?=.*\bSafari\/)(?!.*\b(?:Chrome|Chromium|CriOS|Edg|OPR)\b).*?\bVersion\/(?:1[8-9]|[2-9]\d|17\.(?:0\.(?:[1-9]\d*)|[1-9]\d*))\b/,
);
export const getMediasoupDeviceAsync = async (features: Record<string, boolean | undefined>): Promise<Device> => {
    if (features.isNodeSdk) {
        return new Device({ handlerName: "Safari12" });
    }
    let handlerName: SupportedDevice =
        (await detectDeviceAsync()) ||
        (/applecoremedia|applewebkit|safari/i.test(navigator.userAgent) ? "Safari12" : undefined);

    // Since custom browsers on iOS/iPadOS are using webkit under the hood, we must use
    // the Safari handler even if detected as something else (like Chrome)
    if (/iphone|ipad/i.test(navigator.userAgent)) {
        handlerName = "Safari12";
    }

    if (features.safari17HandlerOn && handlerName === "Safari12" && SAFARI_17_REGEXP.test(navigator.userAgent)) {
        return new Device({ handlerFactory: Safari17.createFactory() });
    }

    return new Device({ handlerName });
};
