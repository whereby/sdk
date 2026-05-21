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
    denoiser: {
        wasm: USE_CDN ? getAssetUrl("assets/denoiser/model.ext.wasm") : null,
        processor: USE_CDN ? getAssetUrl("assets/denoiser/processor.ext.js") : null,
    },
};

export const USE_CDN_ASSETS = USE_CDN;
