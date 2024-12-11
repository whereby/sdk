import { detectDevice, Device } from "mediasoup-client";
import { BuiltinHandlerName } from "mediasoup-client/lib/types";
import { UAParser } from "ua-parser-js";
import { Safari17 } from "./Safari17Handler";
// of the provided ones, this seems to work best in NodeJS
import { Safari12 as NodeDeviceHandler } from "mediasoup-client/lib/handlers/Safari12.js";

type SupportedDevice = BuiltinHandlerName | "NodeJS" | "Safari17" | undefined;
export const getMediasoupDevice = (features: Record<string, boolean | undefined>): Device => {
    if (features.isNodeSdk) {
        return new Device({ handlerFactory: NodeDeviceHandler.createFactory() });
    }

    let handlerName: SupportedDevice =
        detectDevice() || (/applecoremedia|applewebkit|safari/i.test(navigator.userAgent) ? "Safari17" : undefined);

    if (handlerName === "Safari12" && typeof navigator === "object" && typeof navigator.userAgent === "string") {
        const uaParser = new UAParser(navigator.userAgent);
        const browser = uaParser.getBrowser();
        const browserVersion = parseInt(browser.major ?? "0");

        if (browserVersion >= 17 && features.safari17HandlerOn) {
            handlerName = "Safari17";
        }
    }

    // Since custom browsers on iOS/iPadOS are using webkit under the hood, we must use
    // the Safari handler even if detected as something else (like Chrome)
    if (/iphone|ipad/i.test(navigator.userAgent)) handlerName = "Safari17";

    if (handlerName === "Safari17") {
        // we use a custom patched version of the Safari handler that fixes simulcast bandwidth limiting
        return new Device({ handlerFactory: Safari17.createFactory() });
    }

    return new Device({ handlerName });
};
