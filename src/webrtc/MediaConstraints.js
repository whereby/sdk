import adapter from "webrtc-adapter";

const isSafari = adapter.browserDetails.browser === "safari";

export default function getMediaConstraints({
    preferredDeviceIds,
    preferredQuality,
    simulcast,
    usingAspectRatio16x9,
    lowDataMode,
    disableAGC,
    disableAEC,
}) {
    let HIGH_WIDTH = 640;
    let HIGH_HEIGHT = 480;

    let LOW_WIDTH = 320;
    let LOW_HEIGHT = 240;
    let LOW_FPS = 15;

    if (usingAspectRatio16x9) {
        HIGH_WIDTH = isSafari ? 1280 : { min: 640, ideal: 1280 };
        HIGH_HEIGHT = isSafari ? 720 : { min: 360, ideal: 720 };
    }
    if (simulcast) {
        // simulcast and low data mode: max 640x360
        LOW_WIDTH = 640;
        LOW_HEIGHT = 360;
        LOW_FPS = 30; // we still use 30fps because of assumptions about temporal layers
    }

    const isLowQuality = lowDataMode || preferredQuality === "low";
    const constraints = {
        audio: {
            deviceId: preferredDeviceIds.audioId,
        },
        video: {
            width: isLowQuality ? LOW_WIDTH : HIGH_WIDTH,
            height: isLowQuality ? LOW_HEIGHT : HIGH_HEIGHT,
        },
    };
    if (preferredDeviceIds.videoId === "default") {
        constraints.video.facingMode = "user";
    } else {
        constraints.video.deviceId = preferredDeviceIds.videoId;
    }

    if (isLowQuality) {
        constraints.video.frameRate = LOW_FPS;
    } else if (usingAspectRatio16x9) {
        constraints.video.advanced = [
            { width: 1280 },
            { height: 720 },
            { width: 1024 },
            { height: 576 },
            { width: 640 },
            { height: 360 },
        ];
    }

    if (disableAGC) {
        constraints.audio.autoGainControl = false;
    }
    if (disableAEC) {
        constraints.audio.echoCancellation = false;
    }
    return constraints;
}
