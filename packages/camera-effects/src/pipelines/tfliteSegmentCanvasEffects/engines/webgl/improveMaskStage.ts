// @ts-nocheck
import { compileShader, createPiplelineStageProgram, createTexture, glsl } from "./webglHelper";

// improves the quality of the mask by applying a 5x5 gaussian blur kernel
export function buildImproveMaskStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    personMaskTexture,
    improvedMaskTexture,
    outputWidth,
    outputHeight,
) {
    const fragmentShaderSource = glsl`#version 300 es
        precision highp float;
        uniform sampler2D u_personMask;
        uniform vec2 u_texelSize;
        in vec2 v_texCoord;
        out vec4 outColor;
        const float offset[3] = float[](0.0, 1.0, 2.0);
        const float weight[3] = float[](0.38774, 0.24477, 0.06136);
            void main() {
            float blurredAlpha = texture(u_personMask, v_texCoord).a * weight[0];
            for (int i = 1; i < 3; i++) {
                vec2 offset = vec2(offset[i]) * u_texelSize;
                vec2 texCoord = v_texCoord + offset;
                blurredAlpha += texture(u_personMask, texCoord).a * weight[i];
                texCoord = v_texCoord - offset;
                blurredAlpha += texture(u_personMask, texCoord).a * weight[i];
            }
            outColor = vec4(0,0,0,blurredAlpha);
        }`;

    const texelWidth = 1 / outputWidth;
    const texelHeight = 1 / outputHeight;

    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createPiplelineStageProgram(gl, vertexShader, fragmentShader, positionBuffer, texCoordBuffer);
    const personMaskLocation = gl.getUniformLocation(program, "u_personMask");
    const texelSizeLocation = gl.getUniformLocation(program, "u_texelSize");
    const texture1 = createTexture(gl, gl.RGBA8, outputWidth, outputHeight, gl.NEAREST, gl.NEAREST);

    const frameBuffer1 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture1, 0);

    const frameBuffer2 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, improvedMaskTexture, 0);

    gl.useProgram(program);
    gl.uniform1i(personMaskLocation, 1);

    function render() {
        gl.viewport(0, 0, outputWidth, outputHeight);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, personMaskTexture);

        gl.uniform2f(texelSizeLocation, 0, texelHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindTexture(gl.TEXTURE_2D, texture1);
        gl.uniform2f(texelSizeLocation, texelWidth, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer2);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function cleanUp() {
        gl.deleteFramebuffer(frameBuffer2);
        gl.deleteFramebuffer(frameBuffer1);
        gl.deleteTexture(texture1);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
    }

    return { render, cleanUp };
}
