// @ts-nocheck
import { compileShader, createPiplelineStageProgram, createTexture, glsl } from "./webglHelper";

// renders the output from tflite as a mask with
// person opaque and background transparent
export function buildTFLiteOutputToMaskStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    outputTexture,
    tflite,
    outputWidth,
    outputHeight,
    outputMemoryOffset,
) {
    const fragmentShaderSource = glsl`#version 300 es
        precision highp float;
        uniform sampler2D u_inputSegmentation;

        in vec2 v_texCoord;
        out vec4 outColor;

        float getMask(vec2 segmentation) {
            float shift = max(segmentation.r, segmentation.g);
            float backgroundExp = exp(segmentation.r - shift);
            float personExp = exp(segmentation.g - shift);
            return personExp / (backgroundExp + personExp);
        }

        void main() {
            float mask = getMask(texture(u_inputSegmentation, v_texCoord).rg);
            outColor = vec4(vec3(0.0), mask);
        }`;

    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createPiplelineStageProgram(gl, vertexShader, fragmentShader, positionBuffer, texCoordBuffer);
    const inputLocation = gl.getUniformLocation(program, "u_inputSegmentation");
    const inputTexture = createTexture(gl, gl.RG32F, outputWidth, outputHeight, gl.NEAREST, gl.NEAREST);

    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);

    gl.useProgram(program);
    gl.uniform1i(inputLocation, 1);

    function render() {
        gl.viewport(0, 0, outputWidth, outputHeight);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            outputWidth,
            outputHeight,
            gl.RG,
            gl.FLOAT,
            tflite.HEAPF32,
            outputMemoryOffset,
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function cleanUp() {
        gl.deleteFramebuffer(frameBuffer);
        gl.deleteTexture(inputTexture);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
    }

    return { render, cleanUp };
}
