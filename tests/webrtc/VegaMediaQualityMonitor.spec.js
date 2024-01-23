const { default: VegaMediaQualityMonitor } = require("../../src/webrtc/VegaMediaQualityMonitor");

const SELF_CLIENT_ID = "selfClientId";
const CLIENT_ID1 = "remoteClientId1";
const CLIENT_ID2 = "remoteClientId2";
const PRODUCER_ID1 = "producerId1";
const PRODUCER_ID2 = "producerId2";
const CONSUMER_ID1 = "consumerId1";
const CONSUMER_ID2 = "consumerId2";
const CONSUMER_ID3 = "consumerId3";
const logger = {
    warn: jest.fn(),
    error: jest.fn(),
};

describe("VegaMediaQualityMonitor", () => {
    it("should keep track of remote clients producer score", () => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });

        vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID1);
        vegaQualityMonitor.addConsumer(CLIENT_ID2, CONSUMER_ID2);
        vegaQualityMonitor.addConsumer(CLIENT_ID2, CONSUMER_ID3);
        vegaQualityMonitor.addConsumerScore(CLIENT_ID1, CONSUMER_ID1, "video", { producerScores: [10, 10, 10] });
        vegaQualityMonitor.addConsumerScore(CLIENT_ID2, CONSUMER_ID2, "audio", { producerScores: [5] });
        vegaQualityMonitor.addConsumerScore(CLIENT_ID2, CONSUMER_ID3, "video", { producerScores: [8, 0] });

        expect(Object.keys(vegaQualityMonitor._producers).length).toBe(2);
        expect(vegaQualityMonitor._producers[CLIENT_ID1][CONSUMER_ID1].kind).toBe("video");
        expect(vegaQualityMonitor._producers[CLIENT_ID1][CONSUMER_ID1].score).toBe(10);
        expect(vegaQualityMonitor._producers[CLIENT_ID2][CONSUMER_ID2].kind).toBe("audio");
        expect(vegaQualityMonitor._producers[CLIENT_ID2][CONSUMER_ID2].score).toBe(5);
        expect(vegaQualityMonitor._producers[CLIENT_ID2][CONSUMER_ID3].kind).toBe("video");
        expect(vegaQualityMonitor._producers[CLIENT_ID2][CONSUMER_ID3].score).toBe(8);
        vegaQualityMonitor.close();
    });

    it("should keep track of local producer score", () => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });

        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID1);
        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID2);
        vegaQualityMonitor.addProducerScore(SELF_CLIENT_ID, PRODUCER_ID1, "video", [{ score: 10 }, { score: 0 }]);
        vegaQualityMonitor.addProducerScore(SELF_CLIENT_ID, PRODUCER_ID2, "audio", [{ score: 8 }]);

        expect(Object.keys(vegaQualityMonitor._producers).length).toBe(1);
        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID][PRODUCER_ID1].kind).toBe("video");
        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID][PRODUCER_ID1].score).toBe(10);
        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID][PRODUCER_ID2].kind).toBe("audio");
        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID][PRODUCER_ID2].score).toBe(8);
        vegaQualityMonitor.close();
    });

    it.each([
        [[{ score: 10 }, { score: 7 }], 8.5],
        [[{ score: 10 }, { score: 0 }], 10],
        [[{ score: 0 }, { score: 0 }], 0],
    ])("should calculate score average on simulcast/svc local producer score: %o, avg: %s", (score, avg) => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });

        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID1);
        vegaQualityMonitor.addProducerScore(SELF_CLIENT_ID, PRODUCER_ID1, "video", score);

        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID][PRODUCER_ID1].score).toBe(avg);
        vegaQualityMonitor.close();
    });

    it.each([
        [{ producerScores: [10, 7] }, 8.5],
        [{ producerScores: [10, 0] }, 10],
        [{ producerScores: [0, 0] }, 0],
    ])("should calculate score average on simulcast/svc remote producer score: %o, avg: %s", (score, avg) => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });

        vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID1);
        vegaQualityMonitor.addConsumerScore(CLIENT_ID1, CONSUMER_ID1, "video", score);

        expect(vegaQualityMonitor._producers[CLIENT_ID1][CONSUMER_ID1].score).toBe(avg);
        vegaQualityMonitor.close();
    });

    it("should not remove remote client with active producers", () => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });
        vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID1);
        vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID2);
        vegaQualityMonitor.addConsumerScore(CLIENT_ID1, CONSUMER_ID1, "video", { producerScores: [10, 10, 10] });

        vegaQualityMonitor.removeConsumer(CLIENT_ID1, CONSUMER_ID2);

        expect(Object.keys(vegaQualityMonitor._producers).length).toBe(1);
        expect(vegaQualityMonitor._producers[CLIENT_ID1][CONSUMER_ID1].kind).toBe("video");
        expect(vegaQualityMonitor._producers[CLIENT_ID1][CONSUMER_ID1].score).toBe(10);
        vegaQualityMonitor.close();
    });

    it("should remove remote client without active producers", () => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });
        vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID1);
        vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID2);
        vegaQualityMonitor.addConsumerScore(CLIENT_ID1, CONSUMER_ID1, "video", { producerScores: [10, 10, 10] });

        vegaQualityMonitor.removeConsumer(CLIENT_ID1, CONSUMER_ID1);
        vegaQualityMonitor.removeConsumer(CLIENT_ID1, CONSUMER_ID2);

        expect(Object.keys(vegaQualityMonitor._producers).length).toBe(0);
        expect(vegaQualityMonitor._producers[CLIENT_ID1]).toBeUndefined();
        vegaQualityMonitor.close();
    });

    it("should not remove self client with active producers", () => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });
        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID1);
        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID2);
        vegaQualityMonitor.addProducerScore(SELF_CLIENT_ID, PRODUCER_ID2, "video", [{ score: 10 }]);

        vegaQualityMonitor.removeProducer(SELF_CLIENT_ID, PRODUCER_ID1);

        expect(Object.keys(vegaQualityMonitor._producers).length).toBe(1);
        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID][PRODUCER_ID2].kind).toBe("video");
        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID][PRODUCER_ID2].score).toBe(10);
        vegaQualityMonitor.close();
    });

    it("should remove remote client without active producers", () => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });
        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID1);
        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID2);
        vegaQualityMonitor.addProducerScore(SELF_CLIENT_ID, PRODUCER_ID2, "video", [{ score: 10 }]);

        vegaQualityMonitor.removeProducer(SELF_CLIENT_ID, PRODUCER_ID1);
        vegaQualityMonitor.removeProducer(SELF_CLIENT_ID, PRODUCER_ID2);

        expect(Object.keys(vegaQualityMonitor._producers).length).toBe(0);
        expect(vegaQualityMonitor._producers[SELF_CLIENT_ID]).toBeUndefined();
        vegaQualityMonitor.close();
    });

    it("should cleanup on close", async () => {
        const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });
        vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID1);
        vegaQualityMonitor.addProducerScore(SELF_CLIENT_ID, PRODUCER_ID1, "video", [{ score: 10 }]);
        vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID1);
        vegaQualityMonitor.addConsumerScore(CLIENT_ID1, CONSUMER_ID1, "video", { producerScores: [10, 10, 10] });

        const delay = new Promise((resolve) => {
            setTimeout(() => {
                expect(Object.keys(vegaQualityMonitor._producers).length).toBe(2);
                expect(Object.keys(vegaQualityMonitor._clients).length).toBe(2);
                vegaQualityMonitor.close();
                expect(Object.keys(vegaQualityMonitor._producers).length).toBe(0);
                expect(Object.keys(vegaQualityMonitor._clients).length).toBe(0);
                expect(vegaQualityMonitor._intervalHandle).toBeUndefined();
                resolve();
            }, 3200);
        });
        await delay;
    });

    it.each([[null], [undefined], [{}], [[]], [[{ score: 1 }, {}]], [[{ score: 10 }, null]]])(
        "should not throw on unexpected producer score format: %o",
        (illegalScore) => {
            const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });
            vegaQualityMonitor.addProducer(SELF_CLIENT_ID, PRODUCER_ID1);

            expect(() =>
                vegaQualityMonitor.addProducerScore(SELF_CLIENT_ID, PRODUCER_ID1, "video", illegalScore)
            ).not.toThrow();

            vegaQualityMonitor.close();
        }
    );

    it.each([[null], [undefined], [{}], [[]], [[{ score: 1 }, {}]], [[{ score: 10 }, null]]])(
        "should not throw on unexpected consumer score format: %o",
        (illegalScore) => {
            const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });
            vegaQualityMonitor.addConsumer(CLIENT_ID1, CONSUMER_ID1);

            expect(() =>
                vegaQualityMonitor.addConsumerScore(CLIENT_ID1, CONSUMER_ID1, "video", illegalScore)
            ).not.toThrow();

            vegaQualityMonitor.close();
        }
    );

    it.each([[[]], [["id", null]], [[undefined, "id"]], [["id"]]])(
        "should ignore illegal consumer params %o",
        (illegalParams) => {
            const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });

            expect(() => vegaQualityMonitor.addConsumer(illegalParams)).not.toThrow();
            expect(Object.keys(vegaQualityMonitor._producers).length).toBe(0);
        }
    );

    it.each([[[]], [["id", null]], [[undefined, "id"]], [["id"]]])(
        "should ignore illegal producer params %o",
        (illegalParams) => {
            const vegaQualityMonitor = new VegaMediaQualityMonitor({ logger });

            expect(() => vegaQualityMonitor.addProducer(illegalParams)).not.toThrow();
            expect(Object.keys(vegaQualityMonitor._producers).length).toBe(0);
        }
    );
});
