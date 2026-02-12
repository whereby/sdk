// @ts-nocheck
// Processor (todo: rename as pipeline?)
// Takes images as input, in various formats depending on how they
// are transferred if using background-worker, insertable streams, etc,
// and makes them fit the expected format used by the engine (which applies the effects)
// The output is converted back to the appropriate transfer format, and timed
// to match desired framerate

import { EventEmitter } from "events";

// Create worker via URL at runtime to avoid bundler-specific worker imports
import { createCanvas } from "../shared";
import { createCanvasEngine } from "./engines/canvas";
import { createWebGLEngine } from "./engines/webgl";
import TimerWorker from "web-worker:../timer.worker";

class Processor extends EventEmitter {
    constructor({ setup, params, videoWidth, videoHeight, emit }) {
        super();
        this.setup = setup;
        this.params = params;
        this.videoWidth = videoWidth;
        this.videoHeight = videoHeight;
        this._engineLock = Promise.resolve();

        // when run in a background thread we override emit
        if (emit) this.emit = emit;
    }

    async setupEngine(videoWidth, videoHeight, effectCanvas, initialBackgroundFrame) {
        this.videoWidth = videoWidth;
        this.videoHeight = videoHeight;
        this.videoAspectRatio = this.videoWidth / this.videoHeight;

        // canvas for rendering video at full resolution and applying effects
        // if using "canvas" transferMode we render directly to the supplied canvas
        this.effectCanvas = effectCanvas || createCanvas(this.videoWidth, this.videoHeight);

        const createEngine = this.setup.useWebGL ? createWebGLEngine : createCanvasEngine;
        this.engine = await createEngine(
            this.videoWidth,
            this.videoHeight,
            this.setup,
            this.effectCanvas,
            this.params,
            initialBackgroundFrame,
        );

        this.effectCtx = this.engine.effectCtx;

        // initialize background
        if (initialBackgroundFrame) {
            this.updateBackgroundFrame({ frame: initialBackgroundFrame });
        }
    }

    async updateVideoSize({ videoWidth, videoHeight }) {
        // Wait for any pending engine operations and lock engine access
        this._engineLock = this._engineLock.then(async () => {
            const oldBackgroundFrame = this.currentBackgroundFrame;
            this.currentBackgroundFrame = null;
            const oldEngine = this.engine;
            await this.setupEngine(videoWidth, videoHeight, this.effectCanvas, oldBackgroundFrame);
            oldEngine.dispose();
        });
        await this._engineLock;
    }

    // initialize the Processor, loading tensorflow and everything async needed before ready to
    // process images
    async init({ initialBackgroundFrame, useInsertableStreams, effectCanvas }) {
        await this.setupEngine(this.videoWidth, this.videoHeight, effectCanvas, initialBackgroundFrame);

        if (useInsertableStreams) {
            let dropFirst = 5; // ignore first N frames when finding relation between frame and local time
            let localStartTime = 0;
            let frameStartTime = 0;
            let firstFrameRendered = false;

            // eslint-disable-next-line no-undef
            this.transformer = new TransformStream({
                transform: async (frame, controller) => {
                    // keep controller so we can terminate it
                    this.transformController = controller;
                    const frameTimestamp = frame.timestamp;
                    const now = performance.now();
                    if (!localStartTime) {
                        localStartTime = now;
                        frameStartTime = frameTimestamp / 1000;
                    }
                    const elapsedFrameTime = frameTimestamp / 1000 - frameStartTime;
                    const elapsedLocalTime = now - localStartTime;

                    // skip frames when it starts lagging behind, else browser will become unresponsive
                    if (dropFirst > 0 || elapsedLocalTime < elapsedFrameTime + 200) {
                        this.processAndRenderFrame(frame);
                        frame.close();
                        if (this.hasVideoBackground && this.setup.transferType !== "canvas") {
                            // ask for new background frame when using video background
                            this.emit("getbackgroundframe");
                        }
                    } else {
                        frame.close();
                        return;
                    }
                    if (dropFirst > 0) {
                        dropFirst--;
                        localStartTime = now;
                        frameStartTime = frameTimestamp / 1000;
                    }

                    // eslint-disable-next-line no-undef
                    controller.enqueue(new VideoFrame(this.effectCanvas, { timestamp: frameTimestamp }));

                    if (!firstFrameRendered) {
                        firstFrameRendered = true;
                        // notify the first frame is ready - time to switch stream
                        this.emit("firstframerendered");
                    }
                },
            });
        } else if (!this.setup.useBackgroundWorker) {
            // when not using a background worker, and not using insertable streams, we need a separate
            // worker to schedule setTimeouts to prevent pause/throttling when tab/window is inactive/hidden
            this.timerWorker = new TimerWorker();
            this.timerWorker.addEventListener("message", () => {
                this.emit("output", { frame: this.currentOutputFrame }, [this.currentOutputFrame]);
            });
        }

        // notify initialization is done
        this.emit("ready");
    }

    // updates params for adjusting or achieving a different effect
    async updateParams({ params, initialBackgroundFrame }) {
        // Wait for any pending engine operations before accessing this.engine
        await this._engineLock;
        
        this.params = params;

        // reset background in case it has changed
        this.currentBackgroundFrame = null;
        this.currentBackgroundFrameCtx = null;
        if (initialBackgroundFrame) {
            this.updateBackgroundFrame({ frame: initialBackgroundFrame, reInit: true });
        } else {
            this.engine.updateBackgroundFrame(null);
        }

        this.engine.updateParams(params);
    }

    // update background frame
    updateBackgroundFrame({ frame, reInit }) {
        let updatedDimensions;
        if (!this.currentBackgroundFrame) {
            this.hasVideoBackground = this.params.backgroundUrl && this.params.backgroundType === "video";
            updatedDimensions = { x: 0, y: 0, width: this.videoWidth, height: this.videoHeight };
        }

        switch (this.setup.transferType) {
            case "imagebitmap": {
                // an imagebitmap can be drawn on 2d canvas
                this.currentBackgroundFrame = frame;
                break;
            }
            case "imagedata": {
                if (!this.currentBackgroundFrame) {
                    // if imagedata we use a canvas as the background frame and redraw each
                    // incoming frame on that, as we can't use ImageData directly with canvas.draw()
                    this.currentBackgroundFrame = createCanvas(this.videoWidth, this.videoHeight);
                    this.currentBackgroundFrameCtx = this.currentBackgroundFrame.getContext("2d");
                }
                // as we're only transferring the acutal bytes (transferable), we need to recreate the imagedata object
                frame = new ImageData(new Uint8ClampedArray(frame), this.videoWidth, this.videoHeight);
                this.currentBackgroundFrameCtx.putImageData(frame, 0, 0);
                break;
            }
            case "canvas": {
                if (!this.currentBackgroundFrame) {
                    // when using "canvas" we get the backgroundElement directly and we need to calculate
                    // how to fill the background on first frame
                    updatedDimensions.width = frame.videoWidth || frame.naturalWidth || frame.width;
                    updatedDimensions.height = frame.videoHeight || frame.naturalHeight || frame.height;
                    const backgroundAspectRatio = updatedDimensions.width / updatedDimensions.height;
                    if (backgroundAspectRatio > this.videoAspectRatio) {
                        const outsideX = updatedDimensions.width - updatedDimensions.height * this.videoAspectRatio;
                        updatedDimensions.width -= outsideX;
                        updatedDimensions.x = Math.floor(outsideX / 2);
                    } else if (backgroundAspectRatio < this.videoAspectRatio) {
                        const outsideY = updatedDimensions.height - updatedDimensions.width / this.videoAspectRatio;
                        updatedDimensions.height -= outsideY;
                        updatedDimensions.y = Math.floor(outsideY / 2);
                    }
                }
                this.currentBackgroundFrame = frame;
                break;
            }
        }
        this.engine.updateBackgroundFrame(this.currentBackgroundFrame, updatedDimensions, reInit);
    }

    // stop effect and free resources
    terminate() {
        if (this.transformController) this.transformController.terminate();
        if (this.timerWorker) this.timerWorker.terminate();
        if (this.engine) {
            this.engine.dispose();
            this.engine = null;
        }
        this._terminated = true;
        this.emit("terminated");
    }

    // starts processing
    start({ inputStream, outputStream }) {
        // if using insertable streams we will get an inputStream and outputStream, and
        // we need to pipe it though the transformer

        // eslint-disable-next-line no-undef
        if (inputStream) inputStream.pipeThrough(this.transformer).pipeTo(outputStream);
        this.frameCounter = 0;
        this.frameCounterTime = performance.now();
    }

    // process input (called when not using insertable streams)
    async input({ videoFrame, backgroundFrame, requestTime, lastRenderTime, delay }) {
        if (this._terminated) return;

        // calculate estimated returnTime of frame based on
        // processing time and backgroundworker RTT to make it match desired framerate
        const rtt = (Date.now() - requestTime) * 2;
        const returnTime = lastRenderTime + delay - rtt;

        // update background if received
        if (backgroundFrame) this.updateBackgroundFrame({ frame: backgroundFrame });

        // resulting frame with effects applied
        let frame;

        // we need to process input frame depending on transferType
        switch (this.setup.transferType) {
            case "imagebitmap": {
                // possibly due to a chrome@mac bug we need to keep the frame
                // for a while even after we are done using it, might be because
                // of some lazy optimizations. It seems imageBitmap can break a
                // canvas permanently if it is closed to early after beeing used.
                // The alternative could be to detect when the canvas is broken
                // (all zeroes in getImageData) and recreate it+context. We might
                // need both, but trying with this first.
                this.prevVideoFrame?.close();
                this.prevVideoFrame = videoFrame;
                this.processAndRenderFrame(videoFrame);
                // for some reason the async createImageBitmap is currently working
                // better than then sync canvas.transferToImageBitmap. possibly related
                // to above chrome@mac bug.
                frame = await createImageBitmap(this.effectCanvas);
                break;
            }
            case "imagedata": {
                // convert transferred ImageData arrayBuffer back to ImageData
                videoFrame = new ImageData(new Uint8ClampedArray(videoFrame), this.videoWidth, this.videoHeight);
                if (!this.inputCanvas) {
                    // create intermediary canvas
                    this.inputCanvas = createCanvas(this.videoWidth, this.videoHeight);
                    this.inputCanvasCtx = this.inputCanvas.getContext("2d");
                }
                // update canvas and process
                this.inputCanvasCtx.putImageData(videoFrame, 0, 0);
                this.processAndRenderFrame(this.inputCanvas);

                // return ImageData (only the transferrable arrayBuffer)
                frame = this.effectCtx.getImageData(0, 0, this.videoWidth, this.videoHeight).data.buffer;
                break;
            }
            case "canvas": {
                this.processAndRenderFrame(videoFrame);
                frame = this.effectCanvas;
            }
        }
        const returnDelay = Math.max(0, returnTime - Date.now());

        if (this.timerWorker) {
            // use background worker for setTimeouts and keep frame so we can return
            // it from the messagehandler
            this.currentOutputFrame = frame;
            this.timerWorker.postMessage(returnDelay);
        } else {
            setTimeout(() => {
                this.emit("output", { frame }, [frame]);
            }, returnDelay);
        }
    }

    // processes a frame (by input(), or by transformer/insertableStreams)
    processAndRenderFrame(frame) {
        this.engine.processFrame(frame);

        if (this.setup.logToConsole) {
            this.frameCounter++;
            const now = performance.now();
            if (now - this.frameCounterTime > 1000) {
                // eslint-disable-next-line no-console
                console.log(
                    `Running camera effects, ${Math.round(
                        (this.frameCounter * 1000) / (now - this.frameCounterTime),
                    )} fps`,
                );
                this.frameCounter = 0;
                this.frameCounterTime = now;
            }
        }
    }
}

export default Processor;
