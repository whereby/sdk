// @ts-nocheck
import { simd } from "wasm-feature-detect";

import createTflite from "../../../assets/tflite/tflite.js";
import createTfliteSimd from "../../../assets/tflite/tflite-simd.js";
import tfliteWasmUrl from "../../../assets/tflite/tflite.wasm";
import tfliteSimdWasmUrl from "../../../assets/tflite/tflite-simd.wasm";

import modelMeetLiteUrl from "../../../assets/tflite/models/segm_lite_v681.tflite";
import modelMeetFullUrl from "../../../assets/tflite/models/segm_full_v679.tflite";
import modelMLKitUrl from "../../../assets/tflite/models/selfiesegmentation_mlkit-256x256-2021_01_19-v1215.f16.tflite";

export const SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON = 1;
export const SEGMENTATIONMODEL_TYPE_PERSON = 2;

const fixWebPackGeneratedFileUrl = (url) => {
    return new URL(url, location.href).href.replace("assets/js/assets/media", "assets/media");
};

const models = {
    meetlite: {
        url: fixWebPackGeneratedFileUrl(modelMeetLiteUrl),
        type: SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON,
    },
    meetfull: {
        url: fixWebPackGeneratedFileUrl(modelMeetFullUrl),
        type: SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON,
    },
    mlkit: {
        url: fixWebPackGeneratedFileUrl(modelMLKitUrl),
        type: SEGMENTATIONMODEL_TYPE_PERSON,
    },
};

let _tflite = null;
// Returns tensorflow lite, SIMD version if supported
const loadTFLite = async () => {
    if (_tflite) return _tflite; // only load tflite+wasm once
    const simdIsSupported = await simd();
    _tflite = await (simdIsSupported ? createTfliteSimd : createTflite)({
        // override default path hardcoded in tflite.js
        locateFile(path) {
            if (path.endsWith(".wasm")) {
                return fixWebPackGeneratedFileUrl(simdIsSupported ? tfliteSimdWasmUrl : tfliteWasmUrl);
            }
            return path;
        },
    });
    return _tflite;
};

let _currentModelAndInfo;
// Returns tensorflow lite loaded with segmentation model, and model details
export const loadSegmentationModel = async (segmentationModelId) => {
    const model = models[segmentationModelId];
    const tflite = await loadTFLite();
    if (_currentModelAndInfo?.url === model.url) return _currentModelAndInfo; // only load model once

    // fetch model
    const modelResponse = await fetch(model.url);
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

    _currentModelAndInfo = {
        tflite,
        model,
        url: model.url,
        inputHeight,
        inputWidth,
        inputMemoryOffset,
        outputMemoryOffset,
        segmentationPixelCount,
    };
    return _currentModelAndInfo;
};
