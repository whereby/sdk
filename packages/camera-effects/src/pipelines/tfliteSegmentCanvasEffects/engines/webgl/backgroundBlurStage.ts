// @ts-nocheck
import { compileShader, createPiplelineStageProgram, createTexture, glsl } from "./webglHelper";

// will generate a kernel from gaussian function
// take advantage of linear subsampling by sampling between two
// pixels with the correct offset/position between them
// and drop pixels at the edge where the weight is very small
function generateOptimizedGaussianKernel(sigma) {
    const g = (x) => Math.exp(-(x * x) / (2 * sigma * sigma));

    const numbers = [];
    let x = 0;
    let currentSum = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const n = g(x);
        const nextSum = currentSum + (currentSum ? n * 2 : n);
        if (currentSum && n / nextSum < 0.01 && numbers.length % 2) break;
        currentSum = nextSum;
        numbers.push(n);
        x++;
    }

    const weights = numbers.map((n) => n / currentSum);

    const optimizedWeights = [weights[0]];
    const optimizedPositions = [0];

    if (weights.length >= 3 && weights.length % 2 === 1) {
        for (let i = 1; i < weights.length; i += 2) {
            const w1 = weights[i];
            const w2 = weights[i + 1];
            const w = w1 + w2;
            const p = w2 / (w1 + w2);
            optimizedWeights.push(w);
            optimizedPositions.push(i + p);
        }
    }

    return {
        weights: optimizedWeights,
        positions: optimizedPositions,
    };
}

// blurs the background using a gaussian kernel
// doesn't blur the person to prevent halo
// params.coverage adjusts smooth step of mask (default [0,1])
// the blur amount is tuned by 3 parameters:
// params.kernel (3x3, 5x5, 7x7, 9x9)
// params.numPasses
// params.backgroundResampleScale
// ^ because webgl builtin linear scaling is faster but lower quality than gaussian blur shader)
// TODO: should optimize kernels by taking advantage of linear scaling and custom offsets
function buildBlurPass(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    personMaskTexture,
    outputWidth,
    outputHeight,
    params,
) {
    const fragmentShaderSource = glsl`#version 300 es
        precision highp float;
        uniform sampler2D u_inputFrame;
        uniform sampler2D u_personMask;
        uniform float u_weight[20];
        uniform float u_offset[20];
        uniform int u_ksize;
        uniform vec2 u_texelSize;
        in vec2 v_texCoord;
        out vec4 outColor;
        void main() {
            vec4 centerColor = texture(u_inputFrame, v_texCoord);
            float personMask = texture(u_personMask, v_texCoord).a;
            vec4 frameColor = centerColor * u_weight[0] * (1.0 - personMask);
            for (int i = 1; i < u_ksize; i++) {
                vec2 offset = vec2(u_offset[i]) * u_texelSize;
                vec2 texCoord = v_texCoord + offset;
                frameColor += texture(u_inputFrame, texCoord) * u_weight[i] *
                    (1.0 - texture(u_personMask, texCoord).a);
                texCoord = v_texCoord - offset;
                frameColor += texture(u_inputFrame, texCoord) * u_weight[i] *
                    (1.0 - texture(u_personMask, texCoord).a);
            }
            outColor = vec4(frameColor.rgb + (1.0 - frameColor.a) * centerColor.rgb, 1.0);
        }`;

    const scale = params.backgroundResampleScale || 0.2;
    const blurredBackgroundWidth = Math.round(outputWidth * scale);
    const blurredBackgroundHeight = Math.round(outputHeight * scale);
    const texelWidth = 1 / blurredBackgroundWidth;
    const texelHeight = 1 / blurredBackgroundHeight;

    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createPiplelineStageProgram(gl, vertexShader, fragmentShader, positionBuffer, texCoordBuffer);
    const inputFrameLocation = gl.getUniformLocation(program, "u_inputFrame");
    const personMaskLocation = gl.getUniformLocation(program, "u_personMask");
    const texelSizeLocation = gl.getUniformLocation(program, "u_texelSize");
    const weightLocation = gl.getUniformLocation(program, "u_weight");
    const offsetLocation = gl.getUniformLocation(program, "u_offset");
    const kernelsizeLocation = gl.getUniformLocation(program, "u_ksize");
    const texture1 = createTexture(
        gl,
        gl.RGBA8,
        blurredBackgroundWidth,
        blurredBackgroundHeight,
        gl.NEAREST,
        gl.LINEAR,
    );
    const texture2 = createTexture(
        gl,
        gl.RGBA8,
        blurredBackgroundWidth,
        blurredBackgroundHeight,
        gl.NEAREST,
        gl.LINEAR,
    );

    const frameBuffer1 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture1, 0);

    const frameBuffer2 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture2, 0);

    gl.useProgram(program);
    gl.uniform1i(personMaskLocation, 1);

    function updateKernel(kernel = "5x5") {
        gl.useProgram(program);
        if (kernel === "9x9") {
            gl.uniform1i(kernelsizeLocation, 5);
            gl.uniform1fv(weightLocation, [0.227027027, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162]);
            gl.uniform1fv(offsetLocation, [0.0, 1.0, 2.0, 3.0, 4.0]);
        } else if (kernel === "9x9o") {
            gl.uniform1i(kernelsizeLocation, 3);
            gl.uniform1fv(weightLocation, [0.2734375, 0.328125, 0.03515625]);
            gl.uniform1fv(offsetLocation, [0.0, 1.3333333333333333, 3.111111111111111]);
        } else if (kernel === "7x7") {
            gl.uniform1i(kernelsizeLocation, 4);
            gl.uniform1fv(weightLocation, [0.3125, 0.234375, 0.09375, 0.015625]);
            gl.uniform1fv(offsetLocation, [0.0, 1.0, 2.0, 3.0]);
        } else if (kernel === "5x5") {
            gl.uniform1i(kernelsizeLocation, 3);
            gl.uniform1fv(weightLocation, [0.3715, 0.25, 0.0625]);
            gl.uniform1fv(offsetLocation, [0.0, 1.0, 2.0]);
        } else if (kernel === "3x3") {
            gl.uniform1i(kernelsizeLocation, 2);
            gl.uniform1fv(weightLocation, [0.5, 0.25]);
            gl.uniform1fv(offsetLocation, [0.0, 1.0]);
        } else if (kernel === "101o") {
            gl.uniform1i(kernelsizeLocation, 6);
            gl.uniform1fv(
                weightLocation,
                [
                    0.0824930077775077, 0.1570851015371093, 0.12909299748961606, 0.09061657810797075,
                    0.05427127182510044, 0.027687547151449544,
                ],
            );
            gl.uniform1fv(
                offsetLocation,
                [0, 1.4851485148514851, 3.4653465346534653, 5.445544554455446, 7.425742574257426, 9.405940594059405],
            );
        } else if (kernel === "171o") {
            gl.uniform1i(kernelsizeLocation, 7);
            gl.uniform1fv(
                weightLocation,
                [
                    0.06465218005811185, 0.1255973586132927, 0.11180602454697099, 0.09067345726996107,
                    0.06697712131207971, 0.04504642671896425, 0.027573521509675278,
                ],
            );
            gl.uniform1fv(
                offsetLocation,
                [
                    0, 1.4912280701754388, 3.4795321637426904, 5.4678362573099415, 7.456140350877193, 9.444444444444445,
                    11.432748538011696,
                ],
            );
        } else if (kernel.startsWith("og")) {
            // let's us play with custom size kernels: e.g "og4.5" for optimized gaussian kernel sigma/width 4.5
            const s = parseFloat(kernel.substring(2));
            const { weights, positions } = generateOptimizedGaussianKernel(s);
            gl.uniform1i(kernelsizeLocation, weights.length);
            gl.uniform1fv(weightLocation, weights);
            gl.uniform1fv(offsetLocation, positions);
        }
    }

    let numPasses = 1;
    function updateParams(params) {
        updateKernel(params.kernel);
        numPasses = params.numPasses || 1;
    }

    updateParams(params);

    function render() {
        gl.viewport(0, 0, blurredBackgroundWidth, blurredBackgroundHeight);
        gl.useProgram(program);
        gl.uniform1i(inputFrameLocation, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, personMaskTexture);

        for (let i = 0; i < numPasses; i++) {
            gl.uniform2f(texelSizeLocation, 0, texelHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer1);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, texture1);
            gl.uniform1i(inputFrameLocation, 2);

            gl.uniform2f(texelSizeLocation, texelWidth, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer2);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            gl.bindTexture(gl.TEXTURE_2D, texture2);
        }
    }

    function cleanUp() {
        gl.deleteFramebuffer(frameBuffer2);
        gl.deleteFramebuffer(frameBuffer1);
        gl.deleteTexture(texture2);
        gl.deleteTexture(texture1);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
    }

    return {
        render,
        updateParams,
        cleanUp,
    };
}

function buildBlendPass(gl, positionBuffer, texCoordBuffer, outputWidth, outputHeight, params) {
    const vertexShaderSource = glsl`#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() {
            // Flipping Y is required when rendering to canvas
            gl_Position = vec4(a_position * vec2(1.0, -1.0), 0.0, 1.0);
            v_texCoord = a_texCoord;
        }`;

    const fragmentShaderSource = glsl`#version 300 es
        precision highp float;
        uniform sampler2D u_inputFrame;
        uniform sampler2D u_personMask;
        uniform sampler2D u_blurredInputFrame;
        uniform vec2 u_coverage;
        in vec2 v_texCoord;
        out vec4 outColor;
        void main() {
            vec3 color = texture(u_inputFrame, v_texCoord).rgb;
            vec3 blurredColor = texture(u_blurredInputFrame, v_texCoord).rgb;
            float personMask = texture(u_personMask, v_texCoord).a;
            personMask = smoothstep(u_coverage.x, u_coverage.y, personMask);
            outColor = vec4(mix(blurredColor, color, personMask), 1.0);
        }`;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createPiplelineStageProgram(gl, vertexShader, fragmentShader, positionBuffer, texCoordBuffer);
    const inputFrameLocation = gl.getUniformLocation(program, "u_inputFrame");
    const personMaskLocation = gl.getUniformLocation(program, "u_personMask");
    const blurredInputFrame = gl.getUniformLocation(program, "u_blurredInputFrame");
    const coverageLocation = gl.getUniformLocation(program, "u_coverage");

    gl.useProgram(program);
    gl.uniform1i(inputFrameLocation, 0);
    gl.uniform1i(personMaskLocation, 1);
    gl.uniform1i(blurredInputFrame, 2);

    function updateParams(params) {
        gl.useProgram(program);
        const coverage = params.coverage || [0, 1];
        gl.uniform2f(coverageLocation, coverage[0], coverage[1]);
    }

    updateParams(params);

    function render() {
        gl.viewport(0, 0, outputWidth, outputHeight);
        gl.useProgram(program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function cleanUp() {
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
        gl.deleteShader(vertexShader);
    }

    return {
        render,
        updateParams,
        cleanUp,
    };
}

export function buildBackgroundBlurStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    personMaskTexture,
    outputWidth,
    outputHeight,
    params,
) {
    let blurPass = buildBlurPass(
        gl,
        vertexShader,
        positionBuffer,
        texCoordBuffer,
        personMaskTexture,
        outputWidth,
        outputHeight,
        params,
    );
    const blendPass = buildBlendPass(gl, positionBuffer, texCoordBuffer, outputWidth, outputHeight, params);

    function render() {
        blurPass.render();
        blendPass.render();
    }

    let currentResampleScale = params.backgroundResampleScale;

    function updateParams(params) {
        // cleanup and rebuild blur pass when resampling configuration changes
        if (currentResampleScale !== params.backgroundResampleScale) {
            blurPass.cleanUp();
            blurPass = buildBlurPass(
                gl,
                vertexShader,
                positionBuffer,
                texCoordBuffer,
                personMaskTexture,
                outputWidth,
                outputHeight,
                params,
            );
            currentResampleScale = params.backgroundResampleScale;
        }

        blurPass.updateParams(params);
        blendPass.updateParams(params);
    }

    function cleanUp() {
        blendPass.cleanUp();
        blurPass.cleanUp();
    }

    return {
        render,
        updateParams,
        cleanUp,
    };
}
