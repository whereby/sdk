# tfliteSegmentCanvasEffects
- a pipeline for creating effects based on separation/segmentation of person and background
- uses tensorflow lite with machine learned models for person/background segmentation
- achieves different effects (such as blur and background replacement) by using canvas drawing effects (globalCompositeOperation + filter)

## how it works
cameraStream -> inputFrame -> processor -> outputFrame -> effectStream

1. from the cameraStream we grab frames(images), and for each frame we:
2. send the frame to the processor
3. generate a new/replacement frame in the processor with the desired effects applied
4. return the frame
5. feed the frames into the effectStream which was returned to the user

- If we want to replace the background with an image we additionally send the background image to the processor on initialization
- If we want to replace the background with a video we send the frames from this video along with the frames from the camera stream

## worker vs non-worker
the processor and it's heavy work (running/feeding the machine learned models for segmentation, and applying the effects) can run in a webworker for potensial performance gains.

wether it is used in main thread or in a webworker is hidden by the ProcessorProxy and ProcessorProxy.worker - the interface is the same. The Processor (or proxy) takes input via methods and emits output as an eventEmitter.

## processor lifecycle
1. Constructor - not doing much
2. init (async)
    - Load tflite and models
    - Sets up canvases for handling input and applying effects
    - Calculates aspect ratio, crop etc.
    - Sets up insertableStreams TransformStream if enabled
    - Runs tflite/model once without real data as test/js-engine optization
    - Emits "ready"
3. input (while effect is enabled)
    - Gets input frame(image) to process
    - Transforms frame from wire to a common format  
    - Segments and applies effect by calling processAndRenderFrame
    - Transforms output frame back to input format
    - Calcultes when to emit the output to match desired framerate
    - Emits frame with "output"
4. updateParams (change to different effect, same (this) pipeline, while running)
    - updates canvas effects config and background images
    - recalculates cropping etc
5. terminate
    - terminates/stops effect


## processAndRenderFrame, segmentation and effects
For every frame this happens:

1. Segmentation, drawing a mask of the person

inputFrame -> segmentCanvas -> tflite -> mask -> segmentCanvas -> effectCanvas

tflite/model needs the input in a specific resolution: segmentCanvas. We feed tflite from that (via ImageData). We then create a mask (which pixels are person) from the output. Convert to something drawable (reusing segmentCanvas). Finally we draw the mask at effectCanvas in original/input size 

2. Drawing the person

inputFrame -> effectCanvas

We draw the input frame over the mask, resulting in just the person drawn at the effectCanvas at this stage.

3. Drawing the background

A. inputFrame -> effectCanvas (original background)

B. backgroundFrame -> effectCanvas (replacement background)

We fill the rest of the effectCanvas with our desired background

4. Cropping (optional, used with blur)
effectCanvas -> effectCanvas

When blurring we need to crop the image to remove the inset border look (comes from blurring/averaging at edge (nodata = black)

5. after this (processAndRenderFrame) the output frame is grabbed from effectCanvas and converted to wire format

## frame/wire formats
since the processor can run in a worker, frames(images) has to be transferrable accross js-contexts/threads. There are a few different ways of doing this, and support accross browsers/devices has not been mapped out yet.

- ImageData - appears to be widely supported. Beware, if sending it directly - you risk serialization and deserializtion of the base ArrayBuffer which holds the data. We instead transfer the ownership of the arrayBuffer itself, and put it in an ImageData container on the other end. ImageData needs an immediary canvas as it cannot be drawn to a canvas (with effects) directly
- ImageBitmap - experimental, designed for fast rendering. Transferrable. Can be drawn directly to canvas with effects. Mostly for chrome for now, others lack support/some_features
- "InsertableStreams-format". Experimental. When using this we set it up at the main thread, and we only transfer the ownership of the inputStream and outputStream we get from that api - and let the Transformation (inputStream->transform->outputStream) piping/processing happen at the processor (optionally in webworker). Background frames are still transferred using one of the other formats

- "Canvas" When not using a backgroundworker we can also just use the video directly (via a canvas to be able to render with canvas effects), without worrying about transferrable formats.
