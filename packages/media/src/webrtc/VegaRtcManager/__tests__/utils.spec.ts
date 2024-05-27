import { getLayers, getNumberOfActiveVideos, getNumberOfTemporalLayers } from "../utils";

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
});
