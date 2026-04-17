import { Producer } from "mediasoup-client/lib/Producer";
import { addProducerCpuOveruseWatch, getLayers, getNumberOfActiveVideos, getNumberOfTemporalLayers } from "../utils";

describe("utils", () => {
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
