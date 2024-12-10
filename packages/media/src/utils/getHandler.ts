import { detectDevice } from "mediasoup-client";
import { BuiltinHandlerName } from "mediasoup-client/lib/types";
import { UAParser } from "ua-parser-js";

type SupportedDevice = BuiltinHandlerName | "NodeJS" | "Safari17" | undefined;
export const getHandler = (features: Record<string, boolean | undefined>): SupportedDevice => {
    if (features.isNodeSdk) {
        return "NodeJS";
    }

    let handlerName: SupportedDevice =
        detectDevice() || (/applecoremedia|applewebkit|safari/i.test(navigator.userAgent) ? "Safari17" : undefined);

    if (handlerName === "Safari12" && typeof navigator === "object" && typeof navigator.userAgent === "string") {
        const uaParser = new UAParser(navigator.userAgent);
        const browser = uaParser.getBrowser();
        const browserVersion = parseInt(browser.major ?? "0");

        if (browserVersion >= 17 && features.safari17HandlerOn) {
            // we use a custom patched version of the Safari handler that fixes simulcast bandwidth limiting
            handlerName = "Safari17";
        }
    }

    // Since custom browsers on iOS/iPadOS are using webkit under the hood, we must use
    // the Safari handler even if detected as something else (like Chrome)
    if (/iphone|ipad/i.test(navigator.userAgent)) handlerName = "Safari17";

    return handlerName;
};
