const lowPixelCount = 320 * 180;
const lowBitratePerPixel = 150000 / lowPixelCount;
const highPixelCount = 1280 * 720;
const highBitratePerPixel = 1000000 / highPixelCount;
const bitrateChangePerPixel = (highBitratePerPixel - lowBitratePerPixel) / (highPixelCount - lowPixelCount);

// calculates a bitrate for a given resolution+frameRate
export function getOptimalBitrate(width: number, height: number, frameRate: number) {
    let targetPixelCount = width * height;
    if (targetPixelCount < lowPixelCount) targetPixelCount = lowPixelCount;
    if (targetPixelCount > highPixelCount) targetPixelCount = highPixelCount;

    let targetBitratePerPixel = lowBitratePerPixel;
    if (targetPixelCount > highPixelCount) targetBitratePerPixel = highBitratePerPixel;
    else if (targetPixelCount > lowPixelCount) {
        targetBitratePerPixel += (targetPixelCount - lowPixelCount) * bitrateChangePerPixel;
    }

    // we use the actual resolution for the target bitrate
    let targetBitrate = width * height * targetBitratePerPixel;

    // adjust bitrate down a bit if reduced framerate
    if (frameRate <= 15) targetBitrate = targetBitrate * 0.7;
    else if (frameRate <= 24) targetBitrate = targetBitrate * 0.9;

    return targetBitrate;
}
