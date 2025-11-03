import adapter from "webrtc-adapter";

import * as tfliteSegmentCanvasEffectsModule from "./pipelines/tfliteSegmentCanvasEffects";
import { Params, Pipeline, Preset } from "./types";

// check for webgl2 support
const canUseWebGL = (function () {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
})();

// currently only 1 pipeline, using tensorflow lite for person/background segmentation
// the pipeline can be configured to use WebGL or canvas as an engine for effects
// TODO: we should probably remove the concept of a pipeline from config
//   as future effects proabably need to happen in the same pipeline/engine to not waste
//   a lot of cpu/gpu
const pipelines = {
    tfliteSegmentCanvasEffects: {
        module: tfliteSegmentCanvasEffectsModule,

        // setup, when changed the pipeline should be recreated
        // TODO: this should return the proper setup based on browser and feature detection
        // once we have tested and measured what works best
        getDefaultSetup: () => {
            const shared = {
                useWebGL: canUseWebGL,
                segmentationModelId: "meetlite", // meetlite | meetfull | mlkit
                logToConsole: false, // logs some info, like FPS, to console
                framerate: 30, // used when not using insertable streams. 0 for unlimited (for testing performance)
                useInsertableStreams: false, // this needs more testing
                canvasMemoryLeakWorkaround: true, // fixes memory leak/crash in FF, seems to help with artefacts on chrome@linux
                transferType: "canvas",
                useBackgroundWorker: false,
            };

            if (adapter.browserDetails.browser === "chrome") {
                return {
                    ...shared,
                    useWebGL: false, // this will be an gradual rollout on chrome, defaults to false
                };
            }
            if (adapter.browserDetails.browser === "firefox") {
                return {
                    ...shared,
                    transferType: canUseWebGL ? "imagebitmap" : "canvas",
                };
            }
            if (adapter.browserDetails.browser === "safari") {
                return {
                    ...shared,
                    canvasMemoryLeakWorkaround: false,
                    keepVideoElementInDom: true,
                };
            }
            return { ...shared };
        },

        canUse: (options: { allowSafari?: boolean } = {}) =>
            (adapter.browserDetails.browser === "safari" && canUseWebGL && options.allowSafari) ||
            (adapter.browserDetails.browser === "chrome" && (adapter.browserDetails.version ?? 0) >= 90) ||
            (adapter.browserDetails.browser === "firefox" && (adapter.browserDetails?.version ?? 0) >= 89),
    },
};

const presets: Preset[] = [
    {
        id: "slight-blur",
        pipelineConfigs: {
            tfliteSegmentCanvasEffects: {
                params: { backgroundBlur: { amount: "slight" } },
            },
        },
    },
    {
        id: "blur",
        pipelineConfigs: {
            tfliteSegmentCanvasEffects: {
                params: { backgroundBlur: { amount: "normal" } },
            },
        },
    },
    {
        id: "heavy-blur",
        pipelineConfigs: {
            tfliteSegmentCanvasEffects: {
                params: { backgroundBlur: { amount: "heavy" } },
            },
        },
    },
];

presets.push(
    ...[
        { id: "cabin", backgroundUrl: import("../assets/backgrounds/cabin-720p.jpg") },
        { id: "concrete", backgroundUrl: import("../assets/backgrounds/concrete-720p.jpg") },
        { id: "brick", backgroundUrl: import("../assets/backgrounds/brick-720p.jpg") },
        { id: "sunrise", backgroundUrl: import("../assets/backgrounds/sunrise-720p.png") },
        { id: "day", backgroundUrl: import("../assets/backgrounds/day-720p.png") },
        { id: "night", backgroundUrl: import("../assets/backgrounds/night-720p.png") },
        { id: "custom" },
    ].map(({ id, backgroundUrl }) => ({
        id: `image-${id}`,
        pipelineConfigs: {
            tfliteSegmentCanvasEffects: {
                params: {
                    backgroundUrl,
                },
            },
        },
    })),
);

// video works as well
presets.push(
    ...[import("../assets/backgrounds/neon.mp4"), import("../assets/backgrounds/bubbles.mp4")].map(
        (urlModule, index) => ({
            id: `video-${index + 1}`,
            pipelineConfigs: {
                tfliteSegmentCanvasEffects: {
                    params: {
                        backgroundType: "video",
                        backgroundUrl: urlModule,
                    },
                },
            },
        }),
    ),
);

// merges the default setup/params, with anything set by the preset, with anything set by the api user
// returns the merged params, and the first pipeline that supports the preset
const getPresetAndMergedParams = (presetId: string, setup: Pipeline["getDefaultSetup"], params: Params) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    // find first pipeline it can use
    let pipelineId = Object.keys(preset.pipelineConfigs ?? []).find((pipelineId) =>
        pipelines[pipelineId as keyof typeof pipelines].canUse(),
    );
    // if not use first pipeline (for testing on unsupported browsers)
    if (!pipelineId) pipelineId = Object.keys(preset.pipelineConfigs ?? [])[0];
    if (!pipelineId) return;
    const pipelineConfig = preset.pipelineConfigs?.[pipelineId];
    const pipeline = pipelines[pipelineId as keyof typeof pipelines];
    const mergedSetup = { ...pipeline.getDefaultSetup(), ...pipelineConfig?.setup, ...setup };

    // only allow webGL if browser supports it
    mergedSetup.useWebGL = mergedSetup.useWebGL && canUseWebGL;

    const mergedParams = { ...pipelineConfig?.params, ...params };
    return { pipeline, mergedSetup, mergedParams };
};

// There seems to be a bug in safari preventing video elements
// with srcObject set to a generated media stream to update properly
// Having a RAF loop running in the background seems to fix it
const safariKeepAliveVideoSrcObjectHack = () => {
    let stop = false;
    const keepAlive = () =>
        requestAnimationFrame(() => {
            if (!stop) keepAlive();
        });
    keepAlive();
    return () => (stop = true);
};

// returns a new stream with the effect applied on top of inputStream,
// and a method to stop() it and tryUpdate() it
// setup and params can be overrided
// only if it uses the same pipeline and the same setup and the pipeline supports updating can
// the effect be updated. Otherwise the old effect must be stopped, and a new effect must be created.
export const createEffectStream = async (
    inputStream: MediaStream,
    presetId: string,
    setup: Pipeline["getDefaultSetup"],
    params: Params,
) => {
    const { pipeline, mergedSetup, mergedParams } = getPresetAndMergedParams(presetId, setup, params)!;
    if (mergedSetup.logToConsole) {
        // eslint-disable-next-line no-console
        console.log(`Setting effect preset ${presetId}`, { setup: mergedSetup, params: mergedParams });
    }
    const {
        stream,
        stop: stopEffectStream,
        updateParams,
    } = await pipeline.module.createEffectStream(inputStream, mergedSetup, mergedParams);

    const tryUpdate = async (
        updatedPresetId: string,
        updatedSetup: Pipeline["getDefaultSetup"],
        updatedParams: Params,
    ) => {
        const {
            pipeline: updatedPipeline,
            mergedSetup: updatedMergedSetup,
            mergedParams: updatedMergedParams,
        } = getPresetAndMergedParams(updatedPresetId, updatedSetup, updatedParams)!;
        if (
            !updateParams ||
            updatedPipeline !== pipeline ||
            JSON.stringify(updatedMergedSetup) !== JSON.stringify(mergedSetup)
        ) {
            if (mergedSetup.logToConsole) {
                // eslint-disable-next-line no-console
                console.log("Cannot update effect, needs to create new pipeline");
            }
            return false;
        }
        if (mergedSetup.logToConsole) {
            // eslint-disable-next-line no-console
            console.log(`Updating to effect preset ${updatedPresetId}`, { params: updatedMergedParams });
        }
        return await updateParams(updatedMergedParams);
    };

    // start hack if safari and stop when effect is stopped
    const stopSafariHack =
        adapter.browserDetails.browser === "safari" ? safariKeepAliveVideoSrcObjectHack() : () => undefined;

    const stop = () => {
        if (mergedSetup.logToConsole) {
            // eslint-disable-next-line no-console
            console.log("Stopping effects");
        }
        stopSafariHack();
        stopEffectStream();
    };

    return { stream, stop, tryUpdate };
};

// returns list of usable presets. A custom filter ( ()=>true ) can be provided to test effects on unsupported browsers
export const getUsablePresets = (
    filter = (pipeline: Pipeline, options: { allowSafari?: boolean }) => pipeline.canUse(options),
    options: { allowSafari?: boolean },
) =>
    presets
        .filter((preset) =>
            Object.keys(preset.pipelineConfigs ?? []).find((pipelineId) =>
                filter(pipelines[pipelineId as keyof typeof pipelines], options),
            ),
        )
        .map((preset) => preset.id);

// sets the default setup of a pipeline, for testing purposes
export const setDefaultSetup = (pipelineId: string, setup: Pipeline["getDefaultSetup"]) => {
    const oldSetup = pipelines[pipelineId as keyof typeof pipelines].getDefaultSetup();
    const newSetup = { ...oldSetup, ...setup };
    pipelines[pipelineId as keyof typeof pipelines].getDefaultSetup = () => newSetup;
};
