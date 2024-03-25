import { detectDevice } from "mediasoup-client";

export const getHandler = () => {
    let handlerName =
        detectDevice() || (/applecoremedia|applewebkit|safari/i.test(navigator.userAgent) ? "Safari12" : undefined);

    // Since custom browsers on iOS/iPadOS are using webkit under the hood, we must use
    // the Safari handler even if detected as something else (like Chrome)
    if (/iphone|ipad/i.test(navigator.userAgent)) handlerName = "Safari12";

    return handlerName;
};
