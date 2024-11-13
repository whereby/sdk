import { PacketLossAnalyser } from "../packetLossAnalyser";

/**
 * Add periodic packet loss at 30s intervals.
 */
const addPeriodicPacketLoss = (pla: PacketLossAnalyser, ssrcId: string) => {
    let timestamp = Date.now();
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
    pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

    timestamp += 30000; // Next packet loss period 30s after previous.
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
    pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

    timestamp += 30000; // Next packet loss period 30s after previous.
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
    pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

    return timestamp;
};

describe("PacketLossAnalyser", () => {
    let pla: PacketLossAnalyser;
    const ssrcId = "id";

    beforeEach(() => {
        pla = new PacketLossAnalyser();
    });

    it("reports no periodic packet loss on missing ssrc", () => {
        expect(pla.hasPeriodicPacketLoss(ssrcId, Date.now())).toBe(false);
    });

    it("reports periodic packet loss for 3 periods with equal interval", () => {
        let timestamp = Date.now();
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 2000);

        timestamp += 60000; // Next packet loss period 60s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 2000);

        timestamp += 60000; // Next packet loss period 60s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 2000);
        expect(pla.hasPeriodicPacketLoss(ssrcId, timestamp + 2000)).toBe(true);
    });

    it("reports periodic packet loss for 3 periods with some variation in interval", () => {
        let timestamp = Date.now();
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        timestamp += 30000; // Next packet loss period 30s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        timestamp += 32000; // Next packet loss period 32s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        expect(pla.hasPeriodicPacketLoss(ssrcId, timestamp + 4000)).toBe(true);

        timestamp += 28000; // Next packet loss period 28s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        expect(pla.hasPeriodicPacketLoss(ssrcId, timestamp + 4000)).toBe(true);
    });

    it("reports no periodic packet loss on interval change from 30s to 15s", () => {
        let lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId);
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(true);

        lastPeriodTimestamp += 15000; // Begin new packet loss period 15s after previous period.
        pla.addPacketLossMeasurement(ssrcId, 0.05, lastPeriodTimestamp);
        pla.addPacketLossMeasurement(ssrcId, 0, lastPeriodTimestamp + 2000);

        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp + 2000)).toBe(false);
    });

    it("reports no periodic packet loss after a while when there are no new measurements", () => {
        jest.useFakeTimers();
        const lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId);
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(true);

        jest.runAllTimers();

        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(false);
        jest.useRealTimers();
    });

    it("reports no periodic packet loss when previous interval is exceeded", () => {
        let lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId); // 30s interval
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(true);

        lastPeriodTimestamp += 40000; // Past the 30s interval + our accepted diff.

        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(false);
    });
});
