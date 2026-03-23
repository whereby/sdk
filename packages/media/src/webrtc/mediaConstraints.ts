import adapterRaw from "webrtc-adapter";
import { GetConstraintsOptions, GetMediaConstraintsOptions } from "./types";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;
const isSafari = adapter.browserDetails?.browser === "safari";

// Expects format 640x360@25, returns [width, height, fps]
const parseResolution = (res: any) => res.split(/[^\d]/g).map((n: any) => parseInt(n, 10));

/**
 * Low level constraints helper, creates the actual object used for GUM constraints
 */
export function getMediaConstraints({
    audioWanted,
    videoWanted,
    disableAEC,
    disableAGC,
    hd,
    lax,
    lowDataMode,
    preferredDeviceIds,
    resolution,
    simulcast,
    widescreen,
}: GetMediaConstraintsOptions): MediaStreamConstraints {
    let HIGH_HEIGHT: any = 480;
    let LOW_HEIGHT: any = 240;

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

    const { audioId, videoId } = preferredDeviceIds;

    const constraints: MediaStreamConstraints = {
        ...(audioWanted && {
            audio: {
                ...(audioId ? { deviceId: audioId } : {}),
                ...(disableAGC ? { autoGainControl: false } : {}),
                ...(disableAEC ? { echoCancellation: false } : {}),
            },
        }),
        ...(videoWanted && {
            video: {
                height: lowDataMode ? LOW_HEIGHT : HIGH_HEIGHT,
                // Set a lower frame rate (15fps) for low data, but only for non-simulcast.
                // Otherwise use 24fps to increase quality/bandwidth.
                frameRate: lowDataMode && !simulcast ? 15 : 24,
                ...(videoId ? { deviceId: videoId } : { facingMode: "user" }),
            },
        }),
    };
    if (lax) {
        if (audioWanted && !audioId) constraints.audio = true;
        if (videoWanted && !videoId && typeof constraints.video === "object") {
            delete constraints.video.facingMode;
        }
        return constraints;
    }

    if (videoWanted && typeof constraints.video === "object") {
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
    }

    return constraints;
}

/**
 * High level mediaConstraints helper
 */
export default function getConstraints({ devices, videoId, audioId, options, type = "ideal" }: GetConstraintsOptions) {
    const audioDevices = devices.filter((d) => d.kind === "audioinput");
    const videoDevices = devices.filter((d) => d.kind === "videoinput");
    const preferredDeviceIds: { audioId?: any; videoId?: any } = {};
    if (typeof audioId === "string" && audioDevices.some((d) => d.deviceId === audioId)) {
        preferredDeviceIds.audioId = { [type]: audioId };
    }
    if (typeof videoId === "string" && videoDevices.some((d) => d.deviceId === videoId)) {
        preferredDeviceIds.videoId = { [type]: videoId };
    }
    const constraints = getMediaConstraints({
        preferredDeviceIds,
        audioWanted: Boolean(audioId) && audioDevices.length > 0,
        videoWanted: Boolean(videoId) && videoDevices.length > 0,
        ...options,
    });

    return constraints;
}
