// @ts-nocheck
import { compileShader, createPiplelineStageProgram, createTexture, glsl } from "./webglHelper";

// replaces background with image
// params.coverage adjusts smooth step of mask (default [0,1])
// image can be updated for videos
export function buildBackgroundImageStage(
    gl,
    positionBuffer,
    texCoordBuffer,
    personMaskTexture,
    backgroundImage,
    outputWidth,
    outputHeight,
    params,
) {
    const vertexShaderSource = glsl`#version 300 es
        uniform vec2 u_backgroundScale;
        uniform vec2 u_backgroundOffset;
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        out vec2 v_backgroundCoord;
        void main() {
            // Flipping Y for canvas
            gl_Position = vec4(a_position * vec2(1.0, -1.0), 0.0, 1.0);
            v_texCoord = a_texCoord;
            v_backgroundCoord = a_texCoord * u_backgroundScale + u_backgroundOffset;
        }`;

    const fragmentShaderSource = glsl`#version 300 es
        precision highp float;
        uniform sampler2D u_inputFrame;
        uniform sampler2D u_personMask;
        uniform sampler2D u_background;
        uniform vec2 u_coverage;
        in vec2 v_texCoord;
        in vec2 v_backgroundCoord;
        out vec4 outColor;

        void main() {
            vec3 frameColor = texture(u_inputFrame, v_texCoord).rgb;
            vec3 backgroundColor = texture(u_background, v_backgroundCoord).rgb;
            float personMask = texture(u_personMask, v_texCoord).a;
            personMask = smoothstep(u_coverage.x, u_coverage.y, personMask);
            outColor = vec4(frameColor * personMask + backgroundColor * (1.0 - personMask), 1.0);
        }`;

    const outputRatio = outputWidth / outputHeight;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createPiplelineStageProgram(gl, vertexShader, fragmentShader, positionBuffer, texCoordBuffer);
    const backgroundScaleLocation = gl.getUniformLocation(program, "u_backgroundScale");
    const backgroundOffsetLocation = gl.getUniformLocation(program, "u_backgroundOffset");
    const inputFrameLocation = gl.getUniformLocation(program, "u_inputFrame");
    const personMaskLocation = gl.getUniformLocation(program, "u_personMask");
    const backgroundLocation = gl.getUniformLocation(program, "u_background");
    const coverageLocation = gl.getUniformLocation(program, "u_coverage");

    gl.useProgram(program);
    gl.uniform2f(backgroundScaleLocation, 1, 1);
    gl.uniform2f(backgroundOffsetLocation, 0, 0);
    gl.uniform1i(inputFrameLocation, 0);
    gl.uniform1i(personMaskLocation, 1);

    let backgroundTexture = null;

    function render() {
        gl.viewport(0, 0, outputWidth, outputHeight);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, personMaskTexture);
        if (backgroundTexture !== null) {
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
            gl.uniform1i(backgroundLocation, 2);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function initBackgroundImage(backgroundImage) {
        const sourceWidth = backgroundImage.naturalWidth || backgroundImage.videoWidth || backgroundImage.width;
        const sourceHeight = backgroundImage.naturalHeight || backgroundImage.videoHeight || backgroundImage.height;

        backgroundTexture = createTexture(gl, gl.RGBA8, sourceWidth, sourceHeight, gl.LINEAR, gl.LINEAR);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, sourceWidth, sourceHeight, gl.RGBA, gl.UNSIGNED_BYTE, backgroundImage);

        let xOffset = 0;
        let yOffset = 0;
        let backgroundWidth = sourceWidth;
        let backgroundHeight = sourceHeight;
        const backgroundRatio = backgroundWidth / backgroundHeight;
        if (backgroundRatio < outputRatio) {
            backgroundHeight = backgroundWidth / outputRatio;
            yOffset = (sourceHeight - backgroundHeight) / 2;
        } else {
            backgroundWidth = backgroundHeight * outputRatio;
            xOffset = (sourceWidth - backgroundWidth) / 2;
        }

        const xScale = backgroundWidth / sourceWidth;
        const yScale = backgroundHeight / sourceHeight;
        xOffset /= sourceWidth;
        yOffset /= sourceHeight;

        gl.uniform2f(backgroundScaleLocation, xScale, yScale);
        gl.uniform2f(backgroundOffsetLocation, xOffset, yOffset);
    }

    function updateBackgroundImage(backgroundImage, reInit) {
        if (reInit) {
            backgroundTexture = null;
        }
        if (!backgroundImage) {
            if (backgroundTexture) backgroundTexture = null;
            return;
        }
        if (backgroundTexture) {
            gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0,
                0,
                backgroundImage.naturalWidth || backgroundImage.videoWidth || backgroundImage.width,
                backgroundImage.naturalHeight || backgroundImage.videoHeight || backgroundImage.height,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                backgroundImage,
            );
        } else {
            initBackgroundImage(backgroundImage);
        }
    }

    function updateParams(params) {
        gl.useProgram(program);
        const coverage = params.coverage || [0, 1];
        gl.uniform2f(coverageLocation, coverage[0], coverage[1]);
    }

    updateParams(params);
    if (backgroundImage) initBackgroundImage(backgroundImage);

    function cleanUp() {
        gl.deleteTexture(backgroundTexture);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
        gl.deleteShader(vertexShader);
    }

    return {
        render,
        updateParams,
        cleanUp,
        updateBackgroundImage,
    };
}
