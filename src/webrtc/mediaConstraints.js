import adapter from "webrtc-adapter";

const isSafari = adapter.browserDetails.browser === "safari";

// Expects format 640x360@25, returns [width, height, fps]
const parseResolution = (res) => res.split(/[^\d]/g).map((n) => parseInt(n, 10));

/**
 * Low level constraints helper, creates the actual object used for GUM constraints
 */
export function getMediaConstraints({
    disableAEC,
    disableAGC,
    hd,
    lax,
    lowDataMode,
    preferredDeviceIds,
    resolution,
    simulcast,
    widescreen,
}) {
    let HIGH_HEIGHT = 480;
    let LOW_HEIGHT = 240;

    if (hd) {
        // respect user choice, but default to HD for pro, and SD for free
        HIGH_HEIGHT = lax || isSafari ? 720 : { min: 360, ideal: 720 };
    }
    if (simulcast) {
        if (hd === false) {
            HIGH_HEIGHT = 360;
            LOW_HEIGHT = 270;
        } else {
            LOW_HEIGHT = 360;
        }
    }

    const constraints = {
        audio: { ...(preferredDeviceIds.audioId && { deviceId: preferredDeviceIds.audioId }) },
        video: {
            ...(preferredDeviceIds.videoId ? { deviceId: preferredDeviceIds.videoId } : { facingMode: "user" }),
            height: lowDataMode ? LOW_HEIGHT : HIGH_HEIGHT,
            // Set a lower frame rate (15fps) for low data, but only for non-simulcast.
            // Otherwise use 24fps to increase quality/bandwidth.
            frameRate: lowDataMode && !simulcast ? 15 : 24,
        },
    };
    if (lax) {
        if (!constraints.audio.deviceId) constraints.audio = true;
        delete constraints.video.facingMode;
        return constraints;
    }

    if (resolution) {
        const [w, h, fps] = parseResolution(resolution);
        if (w) constraints.video.width = { exact: w };
        if (h) constraints.video.height = { exact: h };
        if (fps) constraints.video.frameRate = { exact: fps };
        // In default camera case, let's just constrain on resolution since you set it
        delete constraints.video.facingMode;
    } else {
        constraints.video.aspectRatio = widescreen ? 16 / 9 : 4 / 3;
    }

    if (disableAGC) constraints.audio.autoGainControl = false;
    if (disableAEC) constraints.audio.echoCancellation = false;
    return constraints;
}

/**
 * High level mediaConstraints helper
 */
export default function getConstraints({ devices, videoId, audioId, options, type = "ideal" }) {
    const audioDevices = devices.filter((d) => d.kind === "audioinput");
    const videoDevices = devices.filter((d) => d.kind === "videoinput");
    const useDefaultAudio = !audioId || !audioDevices.some((d) => d.deviceId === audioId);
    const useDefaultVideo = !videoId || !videoDevices.some((d) => d.deviceId === videoId);
    const constraints = getMediaConstraints({
        preferredDeviceIds: {
            audioId: useDefaultAudio ? null : { [type]: audioId },
            videoId: useDefaultVideo ? null : { [type]: videoId },
        },
        ...options,
    });

    if (audioId === false || !audioDevices.length) {
        delete constraints.audio;
    }
    if (videoId === false || !videoDevices.length) {
        delete constraints.video;
    }

    return constraints;
}
