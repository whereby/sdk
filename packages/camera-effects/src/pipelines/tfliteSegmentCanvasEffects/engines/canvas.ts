// @ts-nocheck
// The canvas engine uses 2d canvas and filtered drawing to
// to achieve desired effects. It runs the segmentation model
// to separate person from background

import {
    loadSegmentationModel,
    SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON,
    SEGMENTATIONMODEL_TYPE_PERSON,
} from "../segmentationModel";

import { createCanvas } from "../../shared";

const baseCanvasParams = {
    maskOperation: "copy",
    maskFilter: "blur(4px)",
    personOperation: "source-in",
    personFilter: "none",
    backgroundOperation: "destination-over",
    backgroundFilter: "none",
};

function getBlurCanvasParams(amount) {
    switch (amount) {
        case "slight": {
            return { ...baseCanvasParams, backgroundFilter: "blur(4px)", crop: 4 };
        }
        case "heavy": {
            return { ...baseCanvasParams, maskFilter: "blur(8px)", backgroundFilter: "blur(16px)", crop: 16 };
        }
    }
    // default
    return { ...baseCanvasParams, maskFilter: "blur(8px)", backgroundFilter: "blur(8px)", crop: 8 };
}

function getCanvasParams(params) {
    if (params.backgroundBlur) return getBlurCanvasParams(params.backgroundBlur.amount);
    return baseCanvasParams;
}

export async function createCanvasEngine(videoWidth, videoHeight, setup, effectCanvas, params) {
    // tflite, model
    const {
        tflite,
        model: segmentationModel,
        inputHeight,
        inputWidth,
        inputMemoryOffset,
        outputMemoryOffset,
        segmentationPixelCount,
    } = await loadSegmentationModel(setup.segmentationModelId);

    let canvasParams = getCanvasParams(params);

    // canvas for rendering images and running segmentation model
    const segmentationCanvas = createCanvas(inputWidth, inputHeight);
    const segmentationCtx = segmentationCanvas.getContext("2d", {
        willReadFrequently: true,
    });

    // image holding result of segmentation model
    const segmentationMask = new ImageData(inputWidth, inputHeight);

    let currentBackgroundFrame = null;
    let backgroundDimensions = { x: 0, y: 0, width: 0, height: 0 };

    // we need to know the video aspect ratio for background and cropping
    const videoAspectRatio = videoWidth / videoHeight;

    // calculates/updates a crop respecting the aspect ratio
    let cropX = 0;
    let cropY = 0;
    const updateCrop = () => {
        const crop = canvasParams.crop || 0;
        if (crop) {
            cropX = videoAspectRatio > 1 ? Math.round(crop * videoAspectRatio) : crop;
            cropY = videoAspectRatio < 1 ? Math.round(crop / videoAspectRatio) : crop;
        } else {
            cropX = 0;
            cropY = 0;
        }
    };
    updateCrop();

    const effectCtx = effectCanvas.getContext("2d");

    return {
        effectCtx,
        updateBackgroundFrame(frame, dimensions) {
            currentBackgroundFrame = frame;
            if (dimensions) backgroundDimensions = dimensions;
        },
        updateParams(updatedParams) {
            canvasParams = getCanvasParams(updatedParams);
            updateCrop();
        },
        processFrame(frame) {
            // copy and resize video to segmentation canvas
            segmentationCtx.drawImage(frame, 0, 0, videoWidth, videoHeight, 0, 0, inputWidth, inputHeight);

            // fill model with input
            const imageData = segmentationCtx.getImageData(0, 0, inputWidth, inputHeight);
            for (let i = 0; i < segmentationPixelCount; i++) {
                tflite.HEAPF32[inputMemoryOffset + i * 3] = imageData.data[i * 4] / 255;
                tflite.HEAPF32[inputMemoryOffset + i * 3 + 1] = imageData.data[i * 4 + 1] / 255;
                tflite.HEAPF32[inputMemoryOffset + i * 3 + 2] = imageData.data[i * 4 + 2] / 255;
            }

            // run model
            tflite._runInference();

            // create segmentation mask image from model result
            for (let i = 0; i < segmentationPixelCount; i++) {
                if (segmentationModel.type === SEGMENTATIONMODEL_TYPE_BACKGROUND_PERSON) {
                    const background = tflite.HEAPF32[outputMemoryOffset + i * 2];
                    const person = tflite.HEAPF32[outputMemoryOffset + i * 2 + 1];
                    const shift = Math.max(background, person);
                    const backgroundExp = Math.exp(background - shift);
                    const personExp = Math.exp(person - shift);
                    segmentationMask.data[i * 4 + 3] = (255 * personExp) / (backgroundExp + personExp);
                } else if (segmentationModel.type === SEGMENTATIONMODEL_TYPE_PERSON) {
                    const person = tflite.HEAPF32[outputMemoryOffset + i];
                    segmentationMask.data[i * 4 + 3] = 255 * person;
                }
            }

            // render result back to segmentation canvas
            segmentationCtx.putImageData(segmentationMask, 0, 0);

            // draw mask with blur on effect canvas
            effectCtx.globalCompositeOperation = canvasParams.maskOperation;
            effectCtx.filter = canvasParams.maskFilter; // FIXME Does not work on Safari
            effectCtx.drawImage(segmentationCanvas, 0, 0, inputWidth, inputHeight, 0, 0, videoWidth, videoHeight);

            // draw person with effects
            effectCtx.globalCompositeOperation = canvasParams.personOperation;
            effectCtx.filter = canvasParams.personFilter;
            effectCtx.drawImage(frame, 0, 0);

            // draw background with effects
            effectCtx.globalCompositeOperation = canvasParams.backgroundOperation;
            effectCtx.filter = canvasParams.backgroundFilter; // Filters does not work on Safari
            if (currentBackgroundFrame) {
                effectCtx.drawImage(
                    currentBackgroundFrame,
                    backgroundDimensions.x,
                    backgroundDimensions.y,
                    backgroundDimensions.width,
                    backgroundDimensions.height,
                    0,
                    0,
                    videoWidth,
                    videoHeight,
                    0,
                );
            } else {
                effectCtx.drawImage(frame, 0, 0);
            }

            // crop and rescale image
            if (cropX || cropY) {
                effectCtx.globalCompositeOperation = "source-over";
                effectCtx.filter = "none";

                effectCtx.drawImage(
                    effectCanvas,
                    cropX,
                    cropY,
                    videoWidth - cropX * 2,
                    videoHeight - cropY * 2,
                    0,
                    0,
                    videoWidth,
                    videoHeight,
                );
            }
        },
        dispose() {},
    };
}
