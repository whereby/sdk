import { Producer } from "mediasoup-client/lib/Producer";

export function getLayers(
    {
        width,
        height,
    }: {
        width: number;
        height: number;
    },
    {
        numberOfActiveVideos,
        numberOfTemporalLayers,
        uncappedSingleRemoteVideoOn,
    }: {
        numberOfActiveVideos: number;
        numberOfTemporalLayers: number;
        uncappedSingleRemoteVideoOn: boolean;
    },
) {
    const maxSide = Math.max(width, height);
    let spatialLayer = maxSide >= 480 ? (maxSide >= 960 ? 2 : 1) : 0;
    let temporalLayer = numberOfTemporalLayers - 1; // default to full framerate

    // if we are rendering tile-like sizes we reduce framerate by 50%
    if (maxSide < 100) {
        temporalLayer = Math.max(numberOfTemporalLayers - 2, 0);
    }

    // if we are rendering many videos, we reduce framerate by 50% for all videos with lowest spatial layer
    if (numberOfActiveVideos > 8 && spatialLayer === 0) {
        temporalLayer = Math.max(numberOfTemporalLayers - 2, 0);
    }

    // increase resolution if few videos (like 1:1 on phones)
    // todo: consider spatialLayer 1 for maxSide > 200. 4 in a room is considerable higher quality on phones this way
    // ... but might conflict with our intent of mobile-mode
    if (numberOfActiveVideos < 4 && maxSide > 300 && spatialLayer === 0) {
        spatialLayer = 1;
    }

    if (uncappedSingleRemoteVideoOn && numberOfActiveVideos === 1) {
        spatialLayer = 2;
        temporalLayer = numberOfTemporalLayers - 1;
    }

    return { spatialLayer, temporalLayer };
}

export function getNumberOfActiveVideos(consumers: any) {
    let numberOfActiveVideos = 0;
    consumers.forEach((c: any) => {
        if (c._closed || c._paused) return;
        if (c._appData?.source === "webcam" || c._appData?.source === "screenvideo") numberOfActiveVideos++;
    });

    return numberOfActiveVideos;
}

export function getNumberOfTemporalLayers(consumer: any) {
    // assume it is using T2 mode unless we detect otherwise
    return /T3/.test(consumer._rtpParameters?.encodings?.[0]?.scalabilityMode || "") ? 3 : 2;
}

const SCALABILITY_MODE_REGEX = /^([LS])([1-9]\d?)T([1-9]\d?)(_KEY)?/;

// When the reduction leaves only the lowest SVC spatial layer active, there's no reason to
// spend more than this on what is by then a heavily downscaled single layer.
const LOWEST_SVC_LAYER_MAX_BITRATE = 100_000; // 100 kbit/s

// SVC spatial layers are dyadic: each layer below the top halves both dimensions, i.e.
// quarters the pixel count, relative to the *original* (full quality) top layer.
// Dropping the top layer(s) of the mode string alone doesn't shrink the resolution or
// bitrate the encoder targets for what remains - the encoder still renders its new top
// layer at the original capture resolution unless scaleResolutionDownBy is adjusted to
// match. So, given the encoding's ORIGINAL scalabilityMode (i.e. from before any reduction
// was ever applied) and the highest spatial layer actually required (0-indexed, where 0 is
// the lowest), this returns the scalabilityMode and scaleResolutionDownBy needed so the new
// top layer lands at the resolution/bitrate it would have had as one of the original layers.
// maxBitrate is capped to LOWEST_SVC_LAYER_MAX_BITRATE when only the lowest layer remains,
// and undefined (meaning: remove any maxBitrate override) as soon as a higher layer is
// required again. Returns undefined when originalScalabilityMode isn't a recognized SVC
// mode (i.e. this isn't an SVC encoding).
export function getReducedSvcEncodingParams(originalScalabilityMode: string | undefined, spatialLayer: number) {
    const match = SCALABILITY_MODE_REGEX.exec(originalScalabilityMode || "");
    if (!match) return undefined;

    const [, mode, originalSpatialLayers, temporalLayers, key = ""] = match;
    const topLayerIndex = Number(originalSpatialLayers) - 1;
    const requiredLayerIndex = Math.min(Math.max(spatialLayer, 0), topLayerIndex);
    const onlyLowestLayerRequired = requiredLayerIndex === 0;

    return {
        scalabilityMode: `${mode}${requiredLayerIndex + 1}T${temporalLayers}${key}`,
        scaleResolutionDownBy: 2 ** (topLayerIndex - requiredLayerIndex),
        maxBitrate: onlyLowestLayerRequired ? LOWEST_SVC_LAYER_MAX_BITRATE : undefined,
    };
}

// this adds a polling monitor for cpu overuse by checking if the lowest layer of a simulcast stream has reduced resolution
//
// on chromium browsers we could probably check the qualityLimitationReason and qualityLimitationDurations, but since not all
// browsers support this (Safari, ...), we instead record the max resolution, and trigger when this has been lowered for a few seconds
//
// it returns a function for stopping and clean up
export function addProducerCpuOveruseWatch({ producer, onOveruse }: { producer: Producer; onOveruse: () => void }) {
    const encodings = producer.rtpParameters?.encodings;

    let interval = null as any;

    // only for 3 layer simulcast
    if (encodings?.length === 3) {
        // we will find lowest layer by matching ssrc or rid to first encoding
        const { ssrc, rid } = encodings[0];

        let maxHeight = 0;
        let ticks = 0;
        const targetTicksForTrigger = 2;

        interval = setInterval(async () => {
            (await producer.getStats()).forEach((report: any) => {
                // we find lowest layer by matching rid (chromium, firefox) or ssrc (safari)
                if (report.type === "outbound-rtp" && ((ssrc && report.ssrc === ssrc) || (rid && report.rid === rid))) {
                    if (maxHeight && report.frameHeight && report.frameHeight < maxHeight) {
                        ticks++;
                        if (ticks >= targetTicksForTrigger) {
                            onOveruse();
                        }
                    } else {
                        // we reset ticks when back to maxHeight, or height is temporary 0 because of network issues
                        ticks = 0;
                    }
                    maxHeight = Math.max(maxHeight, report.frameHeight || 0);
                }
            });
        }, 2000);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
}
