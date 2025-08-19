import { detectDeviceAsync, Device } from "mediasoup-client";
import { BuiltinHandlerName } from "mediasoup-client/lib/types";

type SupportedDevice = BuiltinHandlerName | "NodeJS" | undefined;
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

    return new Device({ handlerName });
};
