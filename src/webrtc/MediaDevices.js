import getConstraints from "./mediaConstraints";
import assert from "../utils/assert";

export const isMobile = /mobi/i.test(navigator.userAgent);

export class NoDevicesError extends Error {
    constructor(...args) {
        super(...args);
        this.name = "nodevices";
    }
}

function removeDuplicates(devices) {
    return devices.filter(
        (device, i, self) => i === self.findIndex((d) => d.deviceId === device.deviceId && d.kind === device.kind)
    );
}

export async function enumerate() {
    const devices = await global.navigator.mediaDevices.enumerateDevices();
    const filteredDevices = removeDuplicates(devices);
    return filteredDevices;
}

const idFieldsByKind = {
    audioinput: "audioId",
    videoinput: "videoId",
    audiooutput: "speakerId",
};

/**
 * Build filtered list of devices, for UI usage
 *
 * @param args
 * @param args.devices - list of available devices
 * @param args.kind - filter by "audioinput" | "videoinput" | "videooutput"
 * @returns Array<{[idField]: deviceId}>
 */
export function buildDeviceList({ busyDeviceIds, devices, kind }) {
    const deviceList =
        devices &&
        devices.length &&
        devices
            .filter((d) => d.kind === kind)
            .map((d) => ({
                [idFieldsByKind[kind]]: d.deviceId,
                label: `${busyDeviceIds.includes(d.deviceId) ? "(busy) " : ""}${d.label || d.deviceId.slice(0, 5)}`,
                busy: busyDeviceIds.includes(d.deviceId),
            }));
    return deviceList && deviceList.length !== 0 ? deviceList : [{ [idFieldsByKind[kind]]: "", label: "Default" }];
}

/**
 * Basically just wrapping getUserMedia
 */
export function getUserMedia(constraints) {
    if (!constraints.audio && !constraints.video) {
        return Promise.reject(new NoDevicesError("No provided devices"));
    }

    return global.navigator.mediaDevices.getUserMedia(constraints).catch((error) => {
        const message = `${error}, ${JSON.stringify(constraints, null, 2)}`;
        console.error(`getUserMedia ${message}`);
        throw error;
    });
}

function getSettingsFromTrack(kind, track, devices, lastUsedId) {
    let settings = { deviceId: null };

    if (!track) {
        // In SFU V2 the track can be closed by the RtcManager, so check if the
        // last used deviceId still is available
        if (lastUsedId && devices) {
            settings.deviceId = devices.find((d) => d.deviceId === lastUsedId && d.kind === kind)?.deviceId;
        }
        return settings;
    }

    settings.label = track.label;

    // if MediaTrackSettings.deviceId is supported (not firefox android/esr)
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings#Browser_compatibility
    if (track.getSettings) {
        settings = { ...settings, ...track.getSettings() };
    }
    if (settings.deviceId) return settings;
    // if MediaTrackCapabilities is supported (not by firefox or samsung internet in general)
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities#Browser_compatibility
    if (track.getCapabilities) {
        settings.deviceId = track.getCapabilities().deviceId;
    }
    if (settings.deviceId) return settings;

    // Firefox ESR (guessing), has no way of getting deviceId, but
    // it probably gives us label, let's use that to find it!
    if (track.label && devices) {
        settings.deviceId = devices.find((d) => track.label === d.label && d.kind === kind)?.deviceId;
    }
    if (settings.deviceId) return settings;

    // Okay. As if the above wasn't hacky enough (it was), this
    // is even more, basically see what we sent before
    // It's really sad if we get down to this point.
    settings.deviceId = track.getConstraints()?.deviceId?.exact;
    settings.broken = 1; // just a hint
    return settings;
}

/**
 * Gets audio and video device data from stream
 *
 * @returns {{video: {deviceId}, audio: {deviceId}}} - the ids are null if not found
 */
export function getDeviceData({ audioTrack, videoTrack, devices, stoppedVideoTrack, lastAudioId, lastVideoId }) {
    const usable = (d) => (d?.readyState === "live" ? d : null);
    videoTrack = usable(videoTrack) || stoppedVideoTrack;
    audioTrack = usable(audioTrack);
    const video = getSettingsFromTrack("videoinput", videoTrack, devices, lastVideoId);
    const audio = getSettingsFromTrack("audioinput", audioTrack, devices, lastAudioId);

    return { video, audio };
}

/**
 * Stops all tracks in a media stream.
 */
export function stopStreamTracks(stream, only) {
    assert(!only || ["audio", "video"].includes(only), "only is invalid");
    if (!only || only === "audio") stream.getAudioTracks().forEach((t) => t.stop());
    if (!only || only === "video") stream.getVideoTracks().forEach((t) => t.stop());
}

/**
 * Replaces tracks in stream with tracks from newStream
 */
export function replaceTracksInStream(stream, newStream, only) {
    // adds before remove to not make stream.ended fire
    // https://github.com/w3c/mediacapture-main/issues/519
    const replacedTracks = [];
    if (!only || only === "audio") {
        replacedTracks.push(...stream.getAudioTracks());
        newStream.getAudioTracks().forEach((track) => {
            track.replacement = true;
            stream.addTrack(track);
        });
    }
    if (!only || only === "video") {
        replacedTracks.push(...stream.getVideoTracks());
        newStream.getVideoTracks().forEach((track) => {
            track.replacement = true;
            stream.addTrack(track);
        });
    }
    replacedTracks.forEach((track) => {
        track.replaced = true;
        stream.removeTrack(track);
    });
    return replacedTracks;
}

async function getTrack({ kind, deviceId, type, fallback = true, primerTrack }) {
    assert(kind === "audio" || kind === "video", "kind must be audio|video");
    const devId = (deviceId) => (type === "exact" ? { deviceId: { exact: deviceId } } : { deviceId });

    const constraints = {
        [kind]: deviceId ? devId(deviceId) : kind === "video" ? { facingMode: "user" } : true,
    };

    let stream;
    try {
        stream = await getUserMedia(constraints);
    } catch (e) {
        if (!fallback) {
            e.details = { constraints, constraint: e.constraint };
            throw e;
        }
        if (primerTrack) {
            return primerTrack;
        }
        stream = await getUserMedia({ [kind]: true });
    }

    return stream.getTracks()[0];
}

async function constrainTrack(track, constraints) {
    while (constraints.length) {
        try {
            await track.applyConstraints(Object.assign({}, ...constraints));
            break;
        } catch (e) {
            const c = constraints.pop();
            console.warn(`unable to apply ${JSON.stringify(c)}`, e);
        }
    }
}

export async function getStream2(constraintOpt, additionalOpts = {}) {
    assert(constraintOpt, "constraints is required");

    const { audioId, videoId, devices, type, options } = constraintOpt;
    const { replaceStream, fallback } = additionalOpts;
    const hasGrantedPermissions = !!devices.find((d) => d.label !== "");
    let audioPrimerTrack;
    let videoPrimerTrack;

    if (!hasGrantedPermissions) {
        try {
            const primerStream = await getUserMedia({
                audio: constraintOpt.audioId !== false,
                video: constraintOpt.videoId !== false,
            });

            audioPrimerTrack = primerStream.getAudioTracks()[0];
            videoPrimerTrack = primerStream.getVideoTracks()[0];
        } catch (err) {
            if (err.name === "NotAllowedError") {
                throw err;
            }
        }
    }

    const getAudio = async () => {
        if (audioId === false) return false;
        if (replaceStream) stopStreamTracks(replaceStream, "audio");
        const audioTrack = await getTrack({
            deviceId: audioId,
            type,
            kind: "audio",
            fallback,
            primerTrack: audioPrimerTrack,
        });

        if (audioPrimerTrack && audioTrack !== audioPrimerTrack) {
            audioPrimerTrack.stop();
        }

        const { disableAEC, disableAGC } = options;
        const changes = [];
        if (disableAGC) {
            changes.push({ autoGainControl: false });
        }
        if (disableAEC) {
            changes.push({ echoCancellation: false });
        }
        await constrainTrack(audioTrack, changes);
        return audioTrack;
    };

    const getVideo = async () => {
        if (videoId === false) return false;
        if (replaceStream) stopStreamTracks(replaceStream, "video");
        const videoTrack = await getTrack({
            deviceId: videoId,
            type,
            kind: "video",
            fallback,
            primerTrack: videoPrimerTrack,
        });

        if (videoPrimerTrack && videoTrack !== videoPrimerTrack) {
            videoPrimerTrack.stop();
        }

        const { lowDataMode, simulcast, usingAspectRatio16x9 } = options;
        const changes = [];
        if (lowDataMode) {
            changes.push({ frameRate: simulcast ? 30 : 15 });
        }
        // 'No preference' should be null, then we could do 4/3 too
        if (usingAspectRatio16x9) {
            changes.push({ aspectRatio: 16 / 9 });
        }
        if (lowDataMode) {
            changes.push({ width: { max: simulcast ? 640 : 320 } });
        } else {
            changes.push({ width: { max: 1280 } });
        }
        await constrainTrack(videoTrack, changes);
        return videoTrack;
    };
    const audioPromise = getAudio();
    const videoPromise = getVideo();
    let audioTrack;
    let videoTrack;
    let error;
    try {
        audioTrack = await audioPromise;
    } catch (e) {
        error = e;
        if (type === "exact") throw e;
    }
    try {
        videoTrack = await videoPromise;
    } catch (e) {
        error = e;
        if (type === "exact") throw e;
    }

    const newStream = new MediaStream([audioTrack, videoTrack].filter(Boolean));
    let replacedTracks;
    if (replaceStream) {
        const only = (audioId === false && "video") || (videoId === false && "audio");
        replacedTracks = replaceTracksInStream(replaceStream, newStream, only);
    }

    return { stream: replaceStream || newStream, error, replacedTracks };
}

/**
 * Gets stream or replace tracks in with some fallbacks
 *
 * @param constraintOpt - for mediaConstraints.getConstraints (audioId/videoId etc)
 * @param options.replaceStream - stream to put new tracks into (instead of returning fresh)
 * @param options.fallback - try to give working stream
 * @returns {Promise<{stream, error=null}>}
 */
export async function getStream(constraintOpt, { replaceStream, fallback = true } = {}) {
    assert(constraintOpt, "constraints is required");

    let error;
    let newConstraints;
    let retryConstraintOpt;
    let stream;

    const only = (constraintOpt.audioId === false && "video") || (constraintOpt.videoId === false && "audio");
    // Mobile can't open two devices at once. Firefox also can't open two audio devices at once.
    // It looks nicer when we don't stop tracks while getting new streams, so we try to not do it
    // unless required.
    const stopTracks = isMobile || only !== "video";
    const constraints = getConstraints(constraintOpt);
    const addDetails = (err, orgErr) => {
        err.details = {
            constraints,
            constraint: err.constraint || orgErr?.constraint,
            newConstraints,
            fallback,
            stopTracks,
            ...(err !== error && { error: String(error) }),
        };
        return err;
    };
    if (stopTracks && replaceStream) stopStreamTracks(replaceStream, only);
    try {
        stream = await getUserMedia(constraints);
    } catch (e) {
        error = e;
        if (!fallback) {
            throw addDetails(e);
        }
        if (e.name === "OverconstrainedError") {
            retryConstraintOpt = {
                deviceId: { videoId: null, audioId: null },
                width: { lax: true },
                height: { lax: true },
                "": { videoId: null, audioId: null, lax: true },
            }[e.constraint || ""];
        } else if (e.name === "NotFoundError") {
            if (constraints.audio && constraints.video) {
                // Since we requested both audio and video, there's
                // a chance only one of the devices are NotFound,
                // let's try to only get one of them.
                try {
                    stream = await getUserMedia(getConstraints({ ...constraintOpt, audioId: false }));
                } catch (e2) {
                    if (e2.name !== "NotFoundError") {
                        throw addDetails(e2, e);
                    }
                }
                try {
                    if (!stream) stream = await getUserMedia(getConstraints({ ...constraintOpt, videoId: false }));
                } catch (e2) {
                    throw addDetails(e2, e);
                }
            }
        } else if (e.name === "NotAllowedError" || e.name === "NotReadableError" || e.name === "AbortError") {
            // NotAllowedError - User didn't allow us
            // NotReadableError - OS can't read
            // AbortError - Other error for browser giving us this

            // Try to revert back to what we had before
            if (replaceStream && !stopTracks) {
                // We didn't stop the tracks, so let's do that and retry
                stopStreamTracks(replaceStream, only);
                retryConstraintOpt = constraintOpt;
            }
            // No existing stream, try to get a new stream
            // if we weren't explicitly disallowed.
            else if (e.name !== "NotAllowedError") {
                // First of all, it seems like NotReadableError is REALLY a
                // OverconstrainedError in many cases, let's try with laxer constraints
                try {
                    stream = await getUserMedia(
                        getConstraints({ ...constraintOpt, options: { ...constraintOpt.options, lax: true } })
                    );
                } catch (e2) {
                    console.warn(`Tried getting stream again with laxer constraints, but failed: ${"" + e2}`);
                }
                // Message often hints at which was the problem, let's use that
                const errMsg = ("" + e).toLowerCase();
                const problemWith = { audio: "audioId", video: "videoId" }[/(video|audio)/.exec(errMsg)?.[0] || only];
                if (!stream && problemWith) {
                    try {
                        stream = await getUserMedia(getConstraints({ ...constraintOpt, [problemWith]: null }));
                    } catch (e2) {
                        console.warn(`Re-tried ${problemWith} with no constraints, but failed: ${"" + e2}`);
                    }
                }
                if (!stream) {
                    // Try disabling the kind we have trouble with
                    // to at least get SOMETHING working
                    const tryOnly = problemWith ? [problemWith] : ["videoId", "audioId"];
                    for (const kind of tryOnly) {
                        try {
                            stream = await getUserMedia(getConstraints({ ...constraintOpt, [kind]: false }));
                        } catch (e2) {
                            console.warn(`Re-tried without ${kind}, but failed: ${"" + e2}`);
                        }
                        if (stream) break;
                    }
                }
            }
        }
    }
    if (retryConstraintOpt) {
        newConstraints = getConstraints({
            ...constraintOpt,
            ...retryConstraintOpt,
            options: { ...constraintOpt.options, lax: retryConstraintOpt.lax },
            ...{ audio: { videoId: false }, video: { audioId: false } }[only],
        });
        try {
            stream = await getUserMedia(newConstraints);
        } catch (e) {
            throw addDetails(e, error);
        }
    }
    if (!stream) {
        throw addDetails(error);
    }
    let replacedTracks;
    if (replaceStream) {
        // In case we didn't do this earlier
        if (!stopTracks) stopStreamTracks(replaceStream, only);
        replacedTracks = replaceTracksInStream(replaceStream, stream, only);
        stream = replaceStream;
    }
    return { error: error && addDetails(error), stream, replacedTracks };
}

export function hasGetDisplayMedia() {
    // Nothing on Android actually has getDisplayMedia yet
    if (global.navigator.userAgent.includes("Android")) {
        return false;
    }
    return !!(global.navigator.mediaDevices || {}).getDisplayMedia;
}

const defaultDisplayMediaConstraints = {
    video: {
        width: { max: window.screen.width },
        height: { max: window.screen.height },
    },
};
/**
 * Gets the display
 *
 * @param {Object} [constraints={ video: true }] constraints - MediaStreamConstraints
 * @returns {Promise<MediaStream>}
 */
export function getDisplayMedia(
    constraints = defaultDisplayMediaConstraints,
    contentHint = "detail" // "detail" | "motion" | "text"
) {
    return global.navigator.mediaDevices.getDisplayMedia(constraints).then((stream) => {
        // Support for video content hint
        // See https://www.w3.org/TR/mst-content-hint/#video-content-hints
        stream.getVideoTracks().forEach((t) => {
            if ("contentHint" in t) {
                t.contentHint = contentHint;
            }
        });
        return stream;
    });
}

export function compareLocalDevices(before, after) {
    const [beforeByKind, afterByKind] = [before, after].map((list) =>
        list
            .filter((device) => device.kind && device.deviceId)
            .reduce(
                (result, device) => ({
                    ...result,
                    [device.kind]: { ...result[device.kind], [device.deviceId]: device },
                }),
                {}
            )
    );
    const changesByKind = {};
    // find devices removed
    before.forEach((device) => {
        if (!device.kind || !device.deviceId) return;
        if (!changesByKind[device.kind]) changesByKind[device.kind] = { added: {}, removed: {}, changed: {} };
        if (!afterByKind[device.kind] || !afterByKind[device.kind][device.deviceId]) {
            changesByKind[device.kind].removed[device.deviceId] = device;
        }
    });
    // find devices either added or changed
    after.forEach((device) => {
        if (!device.kind || !device.deviceId) return;
        if (!changesByKind[device.kind]) changesByKind[device.kind] = { added: {}, removed: {}, changed: {} };
        if (!beforeByKind[device.kind] || !beforeByKind[device.kind][device.deviceId]) {
            changesByKind[device.kind].added[device.deviceId] = device;
        } else if (
            beforeByKind[device.kind][device.deviceId].label && // ignore when initially without label
            beforeByKind[device.kind][device.deviceId].label !== device.label
        ) {
            changesByKind[device.kind].changed[device.deviceId] = device;
        }
    });
    return changesByKind;
}

export function getUpdatedDevices({ oldDevices, newDevices, currentAudioId, currentVideoId, currentSpeakerId }) {
    const changesByKind = compareLocalDevices(oldDevices, newDevices);
    const changedDevices = {};
    const addedDevices = {};
    [
        ["audioinput", currentAudioId],
        ["videoinput", currentVideoId],
        ["audiooutput", currentSpeakerId],
    ].forEach(([kind, currentDeviceId]) => {
        const changes = changesByKind[kind];
        if (!changes) {
            return;
        }
        if (currentDeviceId) {
            // fall back to default if removed
            if (changes.removed[currentDeviceId]) {
                changedDevices[kind] = { deviceId: null }; // let browser decide
                if (kind === "audiooutput") {
                    const fallbackSpeakerDevice = newDevices.find((d) => d.kind === "audiooutput");
                    changedDevices[kind] = { deviceId: fallbackSpeakerDevice?.deviceId };
                }
            }
            // re-request if device has changed
            if (changes.changed[currentDeviceId]) {
                changedDevices[kind] = { deviceId: currentDeviceId };
            }
        }
        // request new device if added
        if (Object.keys(changes.added).length) {
            const [deviceAdded] = Object.keys(changes.added).slice(0, 1);
            const add = changes.added[deviceAdded];
            // device props are not enumerable (used in notificatio
            addedDevices[kind] = { deviceId: add.deviceId, label: add.label, kind: add.kind };
        }
    });

    return { addedDevices, changedDevices };
}
