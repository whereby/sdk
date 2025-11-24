// @ts-nocheck
// temp fix for using webpack async imported images
export async function fixBackgroundUrlPromise(params) {
    if (params.backgroundUrl && params.backgroundUrl.then) {
        const src = await params.backgroundUrl;
        const candidate = src?.default || src;
        if (typeof candidate === "string") {
            try {
                if (
                    !/^https?:\/\//.test(candidate) &&
                    !candidate.startsWith("data:") &&
                    !candidate.startsWith("blob:")
                ) {
                    params.backgroundUrl = new URL(candidate, import.meta.url).href;
                } else {
                    params.backgroundUrl = candidate;
                }
            } catch {
                params.backgroundUrl = candidate;
            }
        } else {
            params.backgroundUrl = candidate;
        }
    }
}

// loads background element and return it when ready to get frames
export async function createBackgroundElement(url, type) {
    if (!url) return;
    let backgroundElement;
    if (type === "video") {
        backgroundElement = document.createElement("video");
        backgroundElement.loop = true;
        await new Promise((resolve) => {
            backgroundElement.addEventListener("playing", resolve);
            backgroundElement.crossOrigin = "Anonymous";
            backgroundElement.src = url;
            backgroundElement.play();
        });
        backgroundElement.muted = true;
    } else {
        backgroundElement = new Image();
        await new Promise((resolve) => {
            backgroundElement.addEventListener("load", resolve);
            backgroundElement.crossOrigin = "Anonymous";
            backgroundElement.src = url;
        });
    }
    return backgroundElement;
}

// returns function that will return a frame from the backgroundElement in the correct dimension and type
export async function createBackgroundProvider(backgroundElement, targetWidth, targetHeight, type) {
    if (!backgroundElement) return async () => undefined;
    const backgroundWidth = backgroundElement.videoWidth || backgroundElement.naturalWidth || backgroundElement.width;
    const backgroundHeight =
        backgroundElement.videoHeight || backgroundElement.naturalHeight || backgroundElement.height;
    const backgroundAspectRatio = backgroundWidth / backgroundHeight;
    const targetAspectRatio = targetWidth / targetHeight;
    if (type === "imagedata") {
        // for imagedata we need an intermediary canvas
        const backgroundCanvas = document.createElement("canvas");
        backgroundCanvas.width = targetWidth;
        backgroundCanvas.height = targetHeight;
        const backgroundCanvasCtx = backgroundCanvas.getContext("2d");

        // calculate how we should draw the backgroundElement to fill the intermediary canvas
        // (not cropping, rendering outside)
        let [sx, sy, sw, sh] = [0, 0, targetWidth, targetHeight];
        if (backgroundAspectRatio > targetAspectRatio) {
            const outsideX = targetHeight * backgroundAspectRatio - targetWidth;
            sx -= Math.round(outsideX / 2);
            sw += Math.round(outsideX);
        } else if (backgroundAspectRatio < targetAspectRatio) {
            const outsideY = targetWidth / backgroundAspectRatio - targetHeight;
            sy -= Math.round(outsideY / 2);
            sh += Math.round(outsideY);
        }

        return async () => {
            backgroundCanvasCtx.drawImage(backgroundElement, 0, 0, backgroundWidth, backgroundHeight, sx, sy, sw, sh);
            return backgroundCanvasCtx.getImageData(0, 0, targetWidth, targetHeight).data.buffer;
        };
    } else if (type === "imagebitmap") {
        // calculate the portion of the backgroundElement we should extract
        // (cropping)
        let [sx, sy, sw, sh] = [0, 0, backgroundWidth, backgroundHeight];
        if (backgroundAspectRatio > targetAspectRatio) {
            const outsideX = backgroundWidth - backgroundHeight * targetAspectRatio;
            sx += Math.round(outsideX / 2);
            sw -= Math.round(outsideX);
        } else if (backgroundAspectRatio < targetAspectRatio) {
            const outsideY = backgroundHeight - backgroundWidth / targetAspectRatio;
            sy += Math.round(outsideY / 2);
            sh -= Math.round(outsideY);
        }

        return async () => {
            return await createImageBitmap(backgroundElement, sx, sy, sw, sh, {
                resizeWidth: targetWidth,
                resizeHeight: targetHeight,
            });
        };
    } else if (type === "canvas") {
        // if "canvas" we just transfer the element and let the processor calculate the crop
        // only works for main thread (no worker)
        return async () => {
            return backgroundElement;
        };
    }
}

// return correct canvas type depending on self/context is main thread or background worker
// on Chrome OffscreenCanvas could probably be used in both contexts,
// but on firefox OffscreenCanvas does not support 2d context atm.
export function createCanvas(width, height) {
    if (self.document) {
        const canvas = self.document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    } else if (self.OffscreenCanvas) {
        return new OffscreenCanvas(width, height);
    }
}
