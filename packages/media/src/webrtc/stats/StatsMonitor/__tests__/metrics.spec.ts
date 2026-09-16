import { captureCommonSsrcMetrics } from "../metrics";

describe("captureCommonSsrcMetrics", () => {
    describe("rawByteCount / rawPacketsLost (inbound)", () => {
        it("passes through the raw cumulative values as-is, unaffected by a stats-diff baseline reset", () => {
            const ssrcMetrics: any = { direction: "in" };

            captureCommonSsrcMetrics(
                ssrcMetrics,
                { packetsReceived: 100, packetsLost: 2, bytesReceived: 10_000 },
                null,
                2000,
                new Map(),
            );

            expect(ssrcMetrics.rawByteCount).toBe(10_000);
            expect(ssrcMetrics.rawPacketsLost).toBe(2);
            expect(ssrcMetrics.byteCount).toBe(10_000);
            expect(ssrcMetrics.packetLossCount).toBe(2);

            captureCommonSsrcMetrics(
                ssrcMetrics,
                { packetsReceived: 150, packetsLost: 3, bytesReceived: 15_000 },
                null,
                2000,
                new Map(),
            );

            expect(ssrcMetrics.rawByteCount).toBe(15_000);
            expect(ssrcMetrics.rawPacketsLost).toBe(3);

            expect(ssrcMetrics.byteCount).toBe(25_000);
            expect(ssrcMetrics.packetLossCount).toBe(5);
        });
    });

    describe("rawByteCount (outbound)", () => {
        it("passes through the raw cumulative bytesSent value as-is", () => {
            const ssrcMetrics: any = { direction: "out" };

            captureCommonSsrcMetrics(ssrcMetrics, { packetsSent: 10, bytesSent: 5_000 }, null, 2000, new Map());

            expect(ssrcMetrics.rawByteCount).toBe(5_000);

            captureCommonSsrcMetrics(ssrcMetrics, { packetsSent: 20, bytesSent: 12_000 }, null, 2000, new Map());

            expect(ssrcMetrics.rawByteCount).toBe(12_000);
        });
    });
});
