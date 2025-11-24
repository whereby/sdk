// @ts-nocheck
import { loadSegmentationModel } from "../../segmentationModel";

import { compileShader, createTexture, glsl } from "./webglHelper";
import { buildBackgroundBlurStage } from "./backgroundBlurStage";
import { buildBackgroundImageStage } from "./backgroundImageStage";
import { buildImproveMaskStage } from "./improveMaskStage";
import { buildTFLiteOutputToMaskStage } from "./tfliteOutputToMaskStage";
import { buildTFLiteInputStage } from "./tfliteInputStage";

function getBlurEngineParams(params) {
    switch (params.amount) {
        case "slight": {
            return { kernel: "og5", numPasses: 1, backgroundResampleScale: 1, ...params };
        }
        case "heavy": {
            return { kernel: "og10", numPasses: 1, backgroundResampleScale: 0.5, ...params };
        }
        default: {
            return { kernel: "og5", numPasses: 1, backgroundResampleScale: 0.5, ...params };
        }
    }
}

function getEngineParams(params) {
    const baseEngineParams = {
        coverage: params.coverage,
    };
    if (params.backgroundBlur) {
        return { baseEngineParams, ...getBlurEngineParams(params.backgroundBlur) };
    }
    return baseEngineParams;
}

// The webgl engine uses WebGL2 shaders
// both for loading segmentation model with data and achieve desired effects
export async function createWebGLEngine(videoWidth, videoHeight, setup, effectCanvas, params, initialBackgroundFrame) {
    // tflite, model
    const { tflite, inputHeight, inputWidth, inputMemoryOffset, outputMemoryOffset, segmentationPixelCount } =
        await loadSegmentationModel(setup.segmentationModelId);

    let engineParams = getEngineParams(params);

    const vertexShaderSource = glsl`#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }`;

    const gl = effectCanvas.getContext("webgl2", setup.webglContextSettings);
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

    const vertexArray = gl.createVertexArray();
    gl.bindVertexArray(vertexArray);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0]), gl.STATIC_DRAW);

    const inputFrameTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, inputFrameTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const maskTexture = createTexture(gl, gl.RGBA8, inputWidth, inputHeight);

    // TODO: play around with resolution
    const improvedMaskWidth = inputWidth;
    const improvedMaskHeight = inputHeight;
    const improvedMaskTexture = createTexture(
        gl,
        gl.RGBA8,
        improvedMaskWidth,
        improvedMaskHeight,
        gl.LINEAR,
        gl.LINEAR,
    );
    const tfliteInputStage = buildTFLiteInputStage(
        gl,
        vertexShader,
        positionBuffer,
        texCoordBuffer,
        tflite,
        inputWidth,
        inputHeight,
        segmentationPixelCount,
        inputMemoryOffset,
    );
    const tfliteOutputToMaskStage = buildTFLiteOutputToMaskStage(
        gl,
        vertexShader,
        positionBuffer,
        texCoordBuffer,
        maskTexture,
        tflite,
        inputWidth,
        inputHeight,
        outputMemoryOffset,
    );
    const improveMaskStage = buildImproveMaskStage(
        gl,
        vertexShader,
        positionBuffer,
        texCoordBuffer,
        maskTexture,
        improvedMaskTexture,
        improvedMaskWidth,
        improvedMaskHeight,
    );
    const backgroundBlurStage = buildBackgroundBlurStage(
        gl,
        vertexShader,
        positionBuffer,
        texCoordBuffer,
        improvedMaskTexture,
        videoWidth,
        videoHeight,
        engineParams,
    );
    const backgroundImageStage = buildBackgroundImageStage(
        gl,
        positionBuffer,
        texCoordBuffer,
        improvedMaskTexture,
        initialBackgroundFrame,
        videoWidth,
        videoHeight,
        engineParams,
    );

    return {
        effectCtx: gl,
        updateBackgroundFrame(frame, _, reInit) {
            backgroundImageStage.updateBackgroundImage(frame, reInit);
        },
        updateParams(updatedParams) {
            params = updatedParams;
            engineParams = getEngineParams(params);
            backgroundBlurStage.updateParams(engineParams);
            backgroundImageStage.updateParams(engineParams);
        },
        processFrame(frame) {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputFrameTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
            gl.bindVertexArray(vertexArray);
            tfliteInputStage.render();
            tflite._runInference();
            tfliteOutputToMaskStage.render();
            improveMaskStage.render();
            // eslint-disable-next-line
            params.backgroundUrl ? backgroundImageStage.render() : backgroundBlurStage.render();
        },
        dispose() {
            backgroundImageStage.cleanUp();
            backgroundBlurStage.cleanUp();
            improveMaskStage.cleanUp();
            tfliteOutputToMaskStage.cleanUp();
            tfliteInputStage.cleanUp();

            gl.deleteTexture(improvedMaskTexture);
            gl.deleteTexture(maskTexture);
            gl.deleteTexture(inputFrameTexture);
            gl.deleteBuffer(texCoordBuffer);
            gl.deleteBuffer(positionBuffer);
            gl.deleteVertexArray(vertexArray);
            gl.deleteShader(vertexShader);
        },
    };
}
