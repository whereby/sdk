// @ts-nocheck
import createProcessor from "./createProcessor";

import { createBackgroundElement, createBackgroundProvider, fixBackgroundUrlPromise, createCanvas } from "../shared";

// guard against createImageBitmap on camera stream failing, returning a gray image instead.
// gray selfview on blur, or just background without person = something wrong with effects
const grayImage = new Image(1, 1);
grayImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
async function _createImageBitmap(source, options) {
    try {
        return await createImageBitmap(source, options);
    } catch {
        return await createImageBitmap(grayImage, options);
    }
}

// returns a new stream with the effect configured in params applied on top of the input stream,
// and a method to stop it and update the params
export const createEffectStream = async (inputStream, setup, params) => {
    // temp: fixes urls from webpack async imported images/videos
    await fixBackgroundUrlPromise(params);

    // list of functions to call when terminated
    const cleanup = [];

    const inputVideoTrack = inputStream.getVideoTracks()[0];
    const inputAudioTrack = inputStream.getAudioTracks()[0];

    let { width: videoWidth, height: videoHeight } = inputVideoTrack.getSettings();

    // the processor will apply the effect
    const processor = createProcessor(setup.useBackgroundWorker, {
        setup,
        params,
        videoWidth,
        videoHeight,
    });

    // if using a video background it needs to be kept alive when tab/window is inactive or hidden
    let keepAliveVideoBackground;

    // prepares background, must be called every time a new background is set
    const updateBackgroundProvider = async (params) => {
        const backgroundElement = await createBackgroundElement(params.backgroundUrl, params.backgroundType);
        keepAliveVideoBackground =
            backgroundElement &&
            backgroundElement.play &&
            (() => {
                if (backgroundElement.paused) backgroundElement.play();
            });
        return createBackgroundProvider(backgroundElement, videoWidth, videoHeight, setup.transferType);
    };

    // initial background
    let getBackgroundFrame = await updateBackgroundProvider(params);

    // keep track of first frame rendered
    let firstFrameRenderedResolve = null;
    const firstFrameRendered = new Promise((resolve) => (firstFrameRenderedResolve = resolve));

    let resultCanvas;
    let outputTrack;

    if (setup.useInsertableStreams) {
        const trackProcessor = new window.MediaStreamTrackProcessor({ track: inputVideoTrack, maxBufferSize: 2 });
        const trackGenerator = new window.MediaStreamTrackGenerator({ kind: "video", signalTarget: inputVideoTrack });
        outputTrack = trackGenerator;

        processor.on("ready", () => {
            processor.start({
                inputStream: trackProcessor?.readable,
                outputStream: trackGenerator?.writable,
            });
        });

        processor.on("firstframerendered", () => firstFrameRenderedResolve());

        processor.on("getbackgroundframe", async () => {
            if (!keepAliveVideoBackground) return;
            keepAliveVideoBackground();
            processor.updateBackgroundFrame({ frame: await getBackgroundFrame() });
        });
    } else {
        // when not using insertable streams we need to "render" the video to an element to grab frames from
        const videoElement = document.createElement("video");

        const onResizeInputStream = async () => {
            const { width, height } = inputVideoTrack.getSettings();
            if (videoWidth === width && videoHeight === height) return;
            videoWidth = width;
            videoHeight = height;
            if (typeof resultCanvas === "object") {
                resultCanvas.width = videoWidth;
                resultCanvas.height = videoHeight;
            }
            await processor.updateVideoSize({ videoWidth, videoHeight });
            await updateBackgroundProvider(params);
        };

        videoElement.addEventListener("resize", onResizeInputStream);
        cleanup.push(() => {
            videoElement.removeEventListener("resize", onResizeInputStream);
        });

        if (setup.keepVideoElementInDom) {
            videoElement.playsInline = true;
            videoElement.style.position = "absolute";
            videoElement.style.top = "0px";
            videoElement.style.left = "0px";
            videoElement.style.width = "1px";
            videoElement.style.opacity = 0;

            document.body.appendChild(videoElement);
            cleanup.push(() => {
                try {
                    document.body.removeChild(videoElement);
                } catch {
                    console.warn("video element already removed from DOM");
                }
                videoElement.srcObject = null;
            });
        }

        await new Promise((resolve) => {
            videoElement.addEventListener("loadedmetadata", resolve);
            videoElement.srcObject = new MediaStream([inputVideoTrack]); // we don't want audio
            videoElement.play();
        });

        // keep video playing when hidden
        const onVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                videoElement.play();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        cleanup.push(() => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
        });

        resultCanvas = createCanvas(videoWidth, videoHeight);

        // depending on transferType we create different versions of the functions
        // for input and rendering
        let resultCanvasCtx;
        let getInputFrame;
        let renderOutputFrame;
        if (setup.transferType === "imagebitmap") {
            resultCanvasCtx = resultCanvas.getContext("bitmaprenderer");
            getInputFrame = () => _createImageBitmap(videoElement);
            renderOutputFrame = (frame) => {
                resultCanvasCtx.transferFromImageBitmap(frame);
                frame.close();
            };
        } else if (setup.transferType === "imagedata") {
            resultCanvasCtx = resultCanvas.getContext("2d");

            // we need an intermediary canvas to get ImageData
            const videoCanvas = createCanvas(videoWidth, videoHeight);
            const videoCanvasCtx = videoCanvas.getContext("2d");

            getInputFrame = () => {
                videoCanvasCtx.drawImage(videoElement, 0, 0);
                return videoCanvasCtx.getImageData(0, 0, videoWidth, videoHeight).data.buffer;
            };
            renderOutputFrame = (frame) => {
                frame = new ImageData(new Uint8ClampedArray(frame), videoWidth, videoHeight);
                resultCanvasCtx.putImageData(frame, 0, 0);
            };
        } else if (setup.transferType === "canvas") {
            resultCanvasCtx = resultCanvas.getContext(
                setup.useWebGL ? "webgl2" : "2d",
                setup.useWebGL ? setup.webglContextSettings : undefined,
            ); // need this (or a frame) for firefox before captureStream()
            getInputFrame = () => videoElement;
            if (setup.useWebGL && setup.canvasMemoryLeakWorkaround)
                getInputFrame = () => _createImageBitmap(videoElement);
            renderOutputFrame = () => {
                // we don't need to anything here, as processor will be rendering to resultCanvas directly
            };
        }

        // capture stream from resultCanvas
        outputTrack = resultCanvas.captureStream().getVideoTracks()[0];

        // keep track of last render time to match wanted framerate
        let lastRenderTime = Date.now();

        const onInputFrame = async () => {
            // make sure background is playing, even if tab is inactive/hidden
            keepAliveVideoBackground?.();
            // get video and background frames
            const [videoFrame, backgroundFrame] = await Promise.all([
                getInputFrame(),
                // only get new background frame if video background
                keepAliveVideoBackground && getBackgroundFrame(),
            ]);

            // send frames to processor
            processor.input({
                videoFrame,
                backgroundFrame,
                lastRenderTime,
                requestTime: Date.now(),
                delay: setup.framerate ? 1000 / setup.framerate : 0,
            });
        };

        const requestInputFrame = () => {
            // TODO: we might want to use videoElement.requestVideoFrameCallback(onInputFrame) to sync to
            // actual framerate. But when going inactive/hidden this stops - so we would need to switch back
            // and forth between requestVideoFrameCallback and setTimeout - maybe calculate video framerate while
            // active and use that (last known framerate) for setTimeout when inactive.
            onInputFrame();
        };

        processor.on("ready", () => {
            requestInputFrame();
            processor.start({});
        });

        processor.on("output", ({ frame }) => {
            lastRenderTime = Date.now();
            renderOutputFrame(frame);
            requestInputFrame();
            if (firstFrameRenderedResolve) {
                firstFrameRenderedResolve();
                firstFrameRenderedResolve = null;
            }
        });
    }

    processor.on("terminated", () => {
        // clean up resources
        cleanup.forEach((t) => t());
    });

    // initialize processor
    processor.init({
        useInsertableStreams: setup.useInsertableStreams,
        initialBackgroundFrame: await getBackgroundFrame(),
        effectCanvas: setup.transferType === "canvas" ? resultCanvas : undefined,
    });

    const stop = () => {
        processor.terminate();
    };

    const updateParams = async (params) => {
        await fixBackgroundUrlPromise(params);
        getBackgroundFrame = await updateBackgroundProvider(params);
        processor.updateParams({
            params,
            initialBackgroundFrame: await getBackgroundFrame(),
        });
        return true;
    };

    // don't return before first frame is rendered (avoid video beeing paused while waiting for initalization)
    await firstFrameRendered;

    // make effect track appear as the original track
    Object.defineProperty(outputTrack, "label", {
        get: () => inputVideoTrack.label,
    });
    Object.defineProperty(outputTrack, "readyState", {
        get: () => inputVideoTrack.readyState,
    });
    Object.defineProperty(outputTrack, "enabled", {
        get: () => inputVideoTrack.enabled,
        set: (value) => {
            inputVideoTrack.enabled = value;
        },
    });
    Object.defineProperty(outputTrack, "getSettings", {
        get: () => () => inputVideoTrack.getSettings(),
    });

    // return a new stream with the new video track and old audio track
    const outputStream = new MediaStream([outputTrack, inputAudioTrack].filter((e) => e));
    return { stream: outputStream, stop, updateParams };
};
