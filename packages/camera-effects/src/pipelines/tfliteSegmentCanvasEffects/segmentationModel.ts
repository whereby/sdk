// @ts-nocheck
import { simd } from "wasm-feature-detect";
import { assetUrls, USE_CDN_ASSETS } from "../../assetUrls";

const loadTfliteModule = async (isSimd: boolean) => {
    const createTfliteModule = isSimd
        ? await import("../../../assets/tflite/tflite-simd.js").then((m) => m.default)
        : await import("../../../assets/tflite/tflite.js").then((m) => m.default);
    return createTfliteModule;
};

const getModelUrl = async (modelId: string) => {
    if (USE_CDN_ASSETS) {
        switch (modelId) {
            case "meetlite":
                return assetUrls.models.segmLite;
            case "meetfull":
                return assetUrls.models.segmFull;
            case "mlkit":
                return assetUrls.models.mlkit;
        }
    } else {
        switch (modelId) {
            case "meetlite":
                return (await import("../../../assets/tflite/models/segm_lite_v681.tflite?url")).default;
            case "meetfull":
                return (await import("../../../assets/tflite/models/segm_full_v679.tflite?url")).default;
            case "mlkit":
                return (
                    await import(
                        "../../../assets/tflite/models/selfiesegmentation_mlkit-256x256-2021_01_19-v1215.f16.tflite?url"
                    )
                ).default;
        }
    }
};

const getWasmUrl = async (isSimd: boolean) => {
    if (USE_CDN_ASSETS) {
        return isSimd ? assetUrls.tflite.wasmSimd : assetUrls.tflite.wasm;
    } else {
        return isSimd
            ? (await import("../../../assets/tflite/tflite-simd.wasm?url")).default
            : (await import("../../../assets/tflite/tflite.wasm?url")).default;
    }
};

export const SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON = 1;
export const SEGMENTATIONMODEL_TYPE_PERSON = 2;

const resolveAssetUrl = (url) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
        return url;
    }
    return new URL(url, import.meta.url).href;
};

const models = {
    meetlite: {
        id: "meetlite",
        type: SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON,
    },
    meetfull: {
        id: "meetfull",
        type: SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON,
    },
    mlkit: {
        id: "mlkit",
        type: SEGMENTATIONMODEL_TYPE_PERSON,
    },
};

let _tflitePromise = null;

const loadTFLite = () => {
    // Cache the in-flight promise, not just the resolved value, so concurrent callers share a single
    // load. Otherwise overlapping calls (e.g. switching effects rapidly on a slow connection) each
    // start their own wasm fetch before the first one resolves.
    if (_tflitePromise) return _tflitePromise;

    _tflitePromise = (async () => {
        try {
            const simdIsSupported = await simd();

            const createTfliteModule = await loadTfliteModule(simdIsSupported);
            const wasmUrl = await getWasmUrl(simdIsSupported);

            return await createTfliteModule({
                locateFile(path) {
                    if (path.endsWith(".wasm")) {
                        return resolveAssetUrl(wasmUrl);
                    }
                    return path;
                },
            });
        } catch (err) {
            // Don't cache a failed load, so a later call can retry.
            _tflitePromise = null;
            throw err;
        }
    })();

    return _tflitePromise;
};

let _modelPromise = null;
let _modelPromiseUrl = null;

export const loadSegmentationModel = async (segmentationModelId) => {
    const model = models[segmentationModelId];
    const modelUrl = resolveAssetUrl(await getModelUrl(model.id));

    // Cache the in-flight promise (keyed by model URL), not just the resolved value, so concurrent
    // callers share a single load. Otherwise overlapping calls each fetch the model and write it into
    // the shared tflite heap.
    if (_modelPromiseUrl === modelUrl && _modelPromise) return _modelPromise;

    _modelPromiseUrl = modelUrl;
    _modelPromise = (async () => {
        try {
            const tflite = await loadTFLite();

            // fetch model
            const modelResponse = await fetch(modelUrl);
            const modelBuffer = await modelResponse.arrayBuffer();
            // copy model to tflite and initialize
            const modelBufferOffset = tflite._getModelBufferMemoryOffset();
            tflite.HEAPU8.set(new Uint8Array(modelBuffer), modelBufferOffset);
            tflite._loadModel(modelBuffer.byteLength);
            // info
            const inputHeight = tflite._getInputHeight();
            const inputWidth = tflite._getInputWidth();
            // TFLite memory will be accessed as float32
            const inputMemoryOffset = tflite._getInputMemoryOffset() / 4;
            const outputMemoryOffset = tflite._getOutputMemoryOffset() / 4;
            const segmentationPixelCount = inputWidth * inputHeight;

            // we run the model once to allow js engine optimizations?
            tflite._runInference();

            return {
                tflite,
                model,
                url: modelUrl,
                inputHeight,
                inputWidth,
                inputMemoryOffset,
                outputMemoryOffset,
                segmentationPixelCount,
            };
        } catch (err) {
            // Don't cache a failed load, so a later call can retry (unless a newer model already replaced it).
            if (_modelPromiseUrl === modelUrl) {
                _modelPromise = null;
                _modelPromiseUrl = null;
            }
            throw err;
        }
    })();

    return _modelPromise;
};
