const CDN_BASE_URL = "__ASSET_CDN_BASE_URL__";

declare const __USE_CDN_ASSETS__: boolean;
const USE_CDN = __USE_CDN_ASSETS__;

const getAssetUrl = (path: string): string => {
    if (USE_CDN) {
        return `${CDN_BASE_URL}/${path}`;
    }
    throw new Error(`Local asset import required for: ${path}`);
};

export const assetUrls = {
    tflite: {
        wasm: USE_CDN ? getAssetUrl("assets/tflite/tflite.wasm") : null,
        wasmSimd: USE_CDN ? getAssetUrl("assets/tflite/tflite-simd.wasm") : null,
    },

    models: {
        segmLite: USE_CDN ? getAssetUrl("assets/tflite/models/segm_lite_v681.tflite") : null,
        segmFull: USE_CDN ? getAssetUrl("assets/tflite/models/segm_full_v679.tflite") : null,
        mlkit: USE_CDN
            ? getAssetUrl("assets/tflite/models/selfiesegmentation_mlkit-256x256-2021_01_19-v1215.f16.tflite")
            : null,
    },

    backgrounds: {
        cabin: USE_CDN ? getAssetUrl("assets/backgrounds/cabin-720p.jpg") : null,
        concrete: USE_CDN ? getAssetUrl("assets/backgrounds/concrete-720p.jpg") : null,
        brick: USE_CDN ? getAssetUrl("assets/backgrounds/brick-720p.jpg") : null,
        sunrise: USE_CDN ? getAssetUrl("assets/backgrounds/sunrise-720p.png") : null,
        day: USE_CDN ? getAssetUrl("assets/backgrounds/day-720p.png") : null,
        night: USE_CDN ? getAssetUrl("assets/backgrounds/night-720p.png") : null,
        clay: USE_CDN ? getAssetUrl("assets/backgrounds/clay-720p.jpg") : null,
        focus: USE_CDN ? getAssetUrl("assets/backgrounds/focus-720p.jpg") : null,
        glow: USE_CDN ? getAssetUrl("assets/backgrounds/glow-720p.jpg") : null,
        haven: USE_CDN ? getAssetUrl("assets/backgrounds/haven-720p.jpg") : null,
        pulse: USE_CDN ? getAssetUrl("assets/backgrounds/pulse-720p.jpg") : null,
        studio: USE_CDN ? getAssetUrl("assets/backgrounds/studio-720p.jpg") : null,
        neon: USE_CDN ? getAssetUrl("assets/backgrounds/neon.mp4") : null,
        bubbles: USE_CDN ? getAssetUrl("assets/backgrounds/bubbles.mp4") : null,
    },
};

export const USE_CDN_ASSETS = USE_CDN;
