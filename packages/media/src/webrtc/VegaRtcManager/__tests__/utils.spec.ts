import { LOWEST_SVC_LAYER_MAX_BITRATE } from "../utils";
import { Producer } from "mediasoup-client/lib/Producer";
import {
    addProducerCpuOveruseWatch,
    aggregateSamples,
    getLayers,
    getNumberOfActiveVideos,
    getNumberOfTemporalLayers,
    getReducedSvcEncodingParams,
    getTopSpatialLayer,
    MAX_METRIC_SAMPLES,
    recordSample,
} from "../utils";

describe("utils", () => {
    describe("aggregateSamples", () => {
        it("computes count/min/max/avg/p95/p99 over the given samples", () => {
            const samples = Array.from({ length: 20 }, (_, i) => (i + 1) * 50);

            expect(aggregateSamples(samples)).toEqual({
                count: 20,
                min: 50,
                max: 1000,
                avg: 525,
                p95: 950,
                p99: 1000,
            });
        });

        it("does not depend on the input array's order, or mutate it", () => {
            const samples = [300, 100, 200];

            expect(aggregateSamples(samples)).toEqual({ count: 3, min: 100, max: 300, avg: 200, p95: 300, p99: 300 });
            expect(samples).toEqual([300, 100, 200]);
        });

        it("handles a single sample", () => {
            expect(aggregateSamples([42])).toEqual({ count: 1, min: 42, max: 42, avg: 42, p95: 42, p99: 42 });
        });
    });

    describe("recordSample", () => {
        it("appends to the array below the cap", () => {
            const samples = [1, 2, 3];

            recordSample(samples, 4);

            expect(samples).toEqual([1, 2, 3, 4]);
        });

        it("keeps the array bounded and drops the oldest samples once far enough over the cap", () => {
            const samples = Array.from({ length: MAX_METRIC_SAMPLES * 2 }, (_, i) => i);

            recordSample(samples, 999999);

            expect(samples.length).toBe(MAX_METRIC_SAMPLES);
            expect(samples[0]).toBe(MAX_METRIC_SAMPLES + 1);
            expect(samples[samples.length - 1]).toBe(999999);
        });
    });

    describe("getLayers", () => {
        it.each`
            width  | height | numberOfActiveVideos | numberOfTemporalLayers | uncappedSingleRemoteVideoOn | expected
            ${400} | ${400} | ${6}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 0, temporalLayer: 1 }}
            ${480} | ${400} | ${6}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 1, temporalLayer: 1 }}
            ${400} | ${400} | ${2}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 1, temporalLayer: 1 }}
            ${200} | ${200} | ${2}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 0, temporalLayer: 1 }}
            ${960} | ${400} | ${2}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 2, temporalLayer: 1 }}
            ${960} | ${400} | ${2}                 | ${3}                   | ${false}                    | ${{ spatialLayer: 2, temporalLayer: 2 }}
            ${99}  | ${99}  | ${2}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 0, temporalLayer: 0 }}
            ${480} | ${480} | ${0}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 1, temporalLayer: 1 }}
            ${960} | ${480} | ${1}                 | ${2}                   | ${false}                    | ${{ spatialLayer: 2, temporalLayer: 1 }}
            ${480} | ${480} | ${1}                 | ${2}                   | ${true}                     | ${{ spatialLayer: 2, temporalLayer: 1 }}
            ${480} | ${480} | ${2}                 | ${2}                   | ${true}                     | ${{ spatialLayer: 1, temporalLayer: 1 }}
        `(
            "expected $expected when width:$width, height:$height, numberOfActiveVideos:$numberOfActiveVideos, numberOfTemporalLayers:$numberOfTemporalLayers, uncappedSingleRemoteVideoOn:$uncappedSingleRemoteVideoOn",
            ({
                width,
                height,
                numberOfActiveVideos,
                numberOfTemporalLayers,
                expected,
                uncappedSingleRemoteVideoOn,
            }) => {
                const result = getLayers(
                    { width, height },
                    { numberOfActiveVideos, numberOfTemporalLayers, uncappedSingleRemoteVideoOn },
                );

                expect(result).toEqual(expected);
            },
        );
    });

    describe("getNumberOfActiveVideos", () => {
        it.each`
            consumers                                                                                  | expected
            ${[]}                                                                                      | ${0}
            ${[{ _closed: true }]}                                                                     | ${0}
            ${[{ _paused: true }]}                                                                     | ${0}
            ${[{}]}                                                                                    | ${0}
            ${[{ _appData: { source: "unknown" } }]}                                                   | ${0}
            ${[{ _appData: { source: "webcam" } }]}                                                    | ${1}
            ${[{ _appData: { source: "screenvideo" } }]}                                               | ${1}
            ${[{ _appData: { source: "webcam" } }, { _appData: { source: "webcam" }, _paused: true }]} | ${1}
            ${[{ _appData: { source: "screenvideo" } }, { _appData: { source: "webcam" } }]}           | ${2}
        `("expected $expected when consumers:$consumers", ({ consumers, expected }) => {
            expect(getNumberOfActiveVideos(consumers)).toEqual(expected);
        });
    });

    describe("getNumberOfTemporalLayers", () => {
        it("should return 2 by default", () => {
            const consumer = { _rtpParameters: { encodings: [{ scalabilityMode: "T2" }] } };

            const result = getNumberOfTemporalLayers(consumer);

            expect(result).toBe(2);
        });

        it("should return 3 when scalabilityMode matches T3", () => {
            const consumer = { _rtpParameters: { encodings: [{ scalabilityMode: "T3 is the thing" }] } };

            const result = getNumberOfTemporalLayers(consumer);

            expect(result).toBe(3);
        });
    });

    describe("getTopSpatialLayer", () => {
        it("returns the last index for simulcast (multiple encodings)", () => {
            expect(getTopSpatialLayer([{}, {}, {}])).toBe(2);
            expect(getTopSpatialLayer([{}, {}])).toBe(1);
        });

        it("returns the spatial layer count minus one for a single SVC encoding", () => {
            expect(getTopSpatialLayer([{ scalabilityMode: "L3T2" }])).toBe(2);
            expect(getTopSpatialLayer([{ scalabilityMode: "L2T2" }])).toBe(1);
        });

        it("returns undefined for a single-spatial-layer SVC mode", () => {
            expect(getTopSpatialLayer([{ scalabilityMode: "L1T3" }])).toBeUndefined();
        });

        it("returns undefined for a plain (non-SVC) single encoding", () => {
            expect(getTopSpatialLayer([{}])).toBeUndefined();
        });

        it("returns undefined when there are no encodings", () => {
            expect(getTopSpatialLayer([])).toBeUndefined();
            expect(getTopSpatialLayer(undefined)).toBeUndefined();
        });

        it("returns undefined for a malformed scalabilityMode with unexpected trailing content", () => {
            expect(getTopSpatialLayer([{ scalabilityMode: "L3T2_UNEXPECTED_SUFFIX" }])).toBeUndefined();
        });
    });

    describe("getReducedSvcEncodingParams", () => {
        it.each`
            originalScalabilityMode | spatialLayer | scalabilityMode | scaleResolutionDownBy | maxBitrate
            ${"L3T2"}               | ${2}         | ${"L3T2"}       | ${1}                  | ${undefined}
            ${"L3T2"}               | ${1}         | ${"L2T2"}       | ${2}                  | ${undefined}
            ${"L3T2"}               | ${0}         | ${"L1T2"}       | ${4}                  | ${LOWEST_SVC_LAYER_MAX_BITRATE}
            ${"L2T2"}               | ${0}         | ${"L1T2"}       | ${2}                  | ${LOWEST_SVC_LAYER_MAX_BITRATE}
            ${"S3T3"}               | ${1}         | ${"S2T3"}       | ${2}                  | ${undefined}
            ${"L3T3_KEY"}           | ${1}         | ${"L2T3_KEY"}   | ${2}                  | ${undefined}
            ${"L1T3"}               | ${0}         | ${"L1T3"}       | ${1}                  | ${LOWEST_SVC_LAYER_MAX_BITRATE}
        `(
            "reduces $originalScalabilityMode to $scalabilityMode scaled down by $scaleResolutionDownBy (maxBitrate $maxBitrate) when the preferred spatial layer is $spatialLayer",
            ({ originalScalabilityMode, spatialLayer, scalabilityMode, scaleResolutionDownBy, maxBitrate }) => {
                expect(getReducedSvcEncodingParams(originalScalabilityMode, spatialLayer)).toEqual({
                    scalabilityMode,
                    scaleResolutionDownBy,
                    maxBitrate,
                });
            },
        );

        it("never raises the spatial layer count above what the original scalabilityMode declared", () => {
            expect(getReducedSvcEncodingParams("L2T2", 5)).toEqual({
                scalabilityMode: "L2T2",
                scaleResolutionDownBy: 1,
                maxBitrate: undefined,
            });
        });

        it("never reduces below a single spatial layer", () => {
            expect(getReducedSvcEncodingParams("L3T2", -1)).toEqual({
                scalabilityMode: "L1T2",
                scaleResolutionDownBy: 4,
                maxBitrate: LOWEST_SVC_LAYER_MAX_BITRATE,
            });
        });

        it("caps maxBitrate only when the lowest layer is the only one preferred, undefined (no cap) otherwise", () => {
            expect(getReducedSvcEncodingParams("L3T2", 0)?.maxBitrate).toBe(LOWEST_SVC_LAYER_MAX_BITRATE);
            expect(getReducedSvcEncodingParams("L3T2", 1)?.maxBitrate).toBeUndefined();
            expect(getReducedSvcEncodingParams("L3T2", 2)?.maxBitrate).toBeUndefined();
        });

        it("returns undefined for a non-SVC (simulcast/plain) encoding", () => {
            expect(getReducedSvcEncodingParams(undefined, 1)).toBeUndefined();
            expect(getReducedSvcEncodingParams("", 1)).toBeUndefined();
        });
    });

    describe("addProducerCpuOveruseWatch", () => {
        const createMockGetStatsReport = (layers: any, encodings: any, getRepeatedProps: any) => {
            return layers.map((layer: any, layerIndex: number) => ({
                id: `reportid-${layerIndex}`,
                type: "outbound-rtp",
                ...layer,
                ...getRepeatedProps(encodings[layerIndex]),
            }));
        };

        const createMockProducer = (encodings: any, reports: any) => {
            let index = 0;
            return {
                getStats: async () => reports[index++],
                get rtpParameters() {
                    return { encodings };
                },
            } as Producer;
        };

        const browserTypes = {
            chromium: {
                getEncodings: (layerCount: number) =>
                    new Array(layerCount).fill(0).map((_, index) => ({ rid: `r${index}` })),
                getRepeatedProps: (encoding: any) => ({ rid: encoding.rid }),
                supported: true,
            },
            safari: {
                getEncodings: (layerCount: number) =>
                    new Array(layerCount).fill(0).map((_, index) => ({ ssrc: `00${index}` })),
                getRepeatedProps: (encoding: any) => ({ ssrc: encoding.ssrc }),
                supported: true,
            },
            unsupported: {
                getEncodings: (layerCount: number) => new Array(layerCount).fill(0).map((_, index) => ({})),
                getRepeatedProps: () => ({}),
                supported: false,
            },
        };

        const createMockProducerFromBrowserTypeConfigAndLayerSets = (
            browserTypeConfig: any,
            layerCount: number,
            layerSets: any,
        ) => {
            return createMockProducer(
                browserTypeConfig.getEncodings(layerCount),
                layerSets.map((layers: any) =>
                    createMockGetStatsReport(
                        layers,
                        browserTypeConfig.getEncodings(layerCount),
                        browserTypeConfig.getRepeatedProps,
                    ),
                ),
            );
        };

        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
            jest.clearAllMocks();
        });

        Object.entries(browserTypes).forEach(([browserType, config]) => {
            const maybeNegate = config.supported ? "not " : "";

            it(`should ${maybeNegate} callback onOveruse when the lowest layer is reduced in height for long enough time, on ${browserType} browsers`, async () => {
                const producer = createMockProducerFromBrowserTypeConfigAndLayerSets(config, 3, [
                    [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                    [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                    [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                    [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                    [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                    [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                    [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                    [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                ]);
                const onOveruse = jest.fn();
                const stopAndCleanup = addProducerCpuOveruseWatch({ producer, onOveruse });

                await jest.advanceTimersToNextTimerAsync();
                await jest.advanceTimersToNextTimerAsync();
                await jest.advanceTimersToNextTimerAsync();

                // only 1 time at lowered resolution, not triggered yet
                expect(onOveruse).not.toHaveBeenCalled();

                await jest.advanceTimersToNextTimerAsync();

                // 2 times at lowered resolution - should be triggered now
                expect(onOveruse).toHaveBeenCalledTimes(config.supported ? 1 : 0);

                await jest.advanceTimersToNextTimerAsync();

                // 3 times at lowered resolution - should be triggered for the 2nd time
                expect(onOveruse).toHaveBeenCalledTimes(config.supported ? 2 : 0);

                await jest.advanceTimersToNextTimerAsync();
                await jest.advanceTimersToNextTimerAsync();

                // almost triggred again, just needs one more
                expect(onOveruse).toHaveBeenCalledTimes(config.supported ? 2 : 0);

                await jest.advanceTimersToNextTimerAsync();

                // triggred again as 2 new samples (in a row) with lowered resolution arrived
                expect(onOveruse).toHaveBeenCalledTimes(config.supported ? 3 : 0);

                stopAndCleanup();
            });
        });

        it("should not callback onOveruse when the lowest layer is reduced in height for only a single sample", async () => {
            const producer = createMockProducerFromBrowserTypeConfigAndLayerSets(browserTypes.chromium, 3, [
                [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
            ]);
            const onOveruse = jest.fn();
            const stopAndCleanup = addProducerCpuOveruseWatch({ producer, onOveruse });

            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();

            expect(onOveruse).not.toHaveBeenCalled();

            stopAndCleanup();
        });

        it("should not callback onOveruse when there are less than 3 layers", async () => {
            const producer = createMockProducerFromBrowserTypeConfigAndLayerSets(browserTypes.chromium, 2, [
                [{ frameHeight: 180 }, { frameHeight: 360 }],
                [{ frameHeight: 180 }, { frameHeight: 360 }],
                [{ frameHeight: 90 }, { frameHeight: 180 }],
                [{ frameHeight: 90 }, { frameHeight: 180 }],
            ]);
            const onOveruse = jest.fn();
            const stopAndCleanup = addProducerCpuOveruseWatch({ producer, onOveruse });

            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();

            expect(onOveruse).not.toHaveBeenCalled();

            stopAndCleanup();
        });

        it("should not callback onOveruse after watch is stopped", async () => {
            const producer = createMockProducerFromBrowserTypeConfigAndLayerSets(browserTypes.chromium, 3, [
                [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
            ]);
            const onOveruse = jest.fn();
            const stopAndCleanup = addProducerCpuOveruseWatch({ producer, onOveruse });

            await jest.advanceTimersToNextTimerAsync();
            stopAndCleanup();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();

            expect(onOveruse).not.toHaveBeenCalled();
        });

        it("should not care about ramping up layers", async () => {
            const producer = createMockProducerFromBrowserTypeConfigAndLayerSets(browserTypes.chromium, 3, [
                [{ frameHeight: 180 }],
                [{ frameHeight: 180 }, { frameHeight: 360 }],
                [{ frameHeight: 180 }, { frameHeight: 360 }, { frameHeight: 720 }],
                [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
                [{ frameHeight: 90 }, { frameHeight: 180 }, { frameHeight: 360 }],
            ]);
            const onOveruse = jest.fn();
            const stopAndCleanup = addProducerCpuOveruseWatch({ producer, onOveruse });

            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();
            await jest.advanceTimersToNextTimerAsync();

            expect(onOveruse).toHaveBeenCalledTimes(1);

            stopAndCleanup();
        });
    });
});
