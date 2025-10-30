// @ts-nocheck
import { compileShader, createPiplelineStageProgram, createTexture, glsl } from "./webglHelper";

// resizes input video to match segmentation model and renders it 3x in horizontal
// direction, once for each color, interleaved. The values are coded as floats
// by using a provided lookup table. This way the data can be fed directly into tflite
export function buildTFLiteInputStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    tflite,
    inputWidth,
    inputHeight,
    segmentationPixelCount,
    inputMemoryOffset,
) {
    const fragmentShaderSource = glsl`#version 300 es
        precision highp float;
        uniform sampler2D u_inputFrame;
        uniform sampler2D u_floatlut;
        in vec2 v_texCoord;
        uniform float u_pixelSize;
        out vec4 outColor;

        void main() {
            float x = v_texCoord.x;
            vec4 color = texture(u_inputFrame, v_texCoord);
            float r = mod(x * u_pixelSize, 3.0);
            float c = 0.0;
            if (r >= 2.0 ) c = color.b;
            else if (r >= 1.0) c = color.g;
            else c = color.r;
            outColor = texture(u_floatlut, vec2(c, 0.5));
        }`;

    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createPiplelineStageProgram(gl, vertexShader, fragmentShader, positionBuffer, texCoordBuffer);
    const inputFrameLocation = gl.getUniformLocation(program, "u_inputFrame");
    const pixelSizeLocation = gl.getUniformLocation(program, "u_pixelSize");
    const floatlutLocation = gl.getUniformLocation(program, "u_floatlut");
    const outputTexture = createTexture(gl, gl.RGBA8, inputWidth * 3, inputHeight);

    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);
    const outputPixels = new Uint8Array(tflite.HEAPF32.buffer, inputMemoryOffset * 4, segmentationPixelCount * 4 * 3);

    gl.useProgram(program);
    gl.uniform1i(inputFrameLocation, 0);
    gl.uniform1f(pixelSizeLocation, inputWidth * 3);
    gl.uniform1i(floatlutLocation, 3);

    // create a LUT-texture for converting and returning floats
    // directly from shader to tflite
    const floatLutTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, floatLutTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) lut[i] = i / 256;
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(lut.buffer, 0, 256 * 4),
    );

    function render() {
        gl.viewport(0, 0, inputWidth * 3, inputHeight);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, floatLutTexture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.readPixels(0, 0, inputWidth * 3, inputHeight, gl.RGBA, gl.UNSIGNED_BYTE, outputPixels);
    }

    function cleanUp() {
        gl.deleteFramebuffer(frameBuffer);
        gl.deleteTexture(outputTexture);
        gl.deleteTexture(floatLutTexture);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
    }

    return { render, cleanUp };
}
