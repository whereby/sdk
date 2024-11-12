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
        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(false);
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
        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(true);
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

        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(true);

        timestamp += 28000; // Next packet loss period 28s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(true);
    });

    it("reports no periodic packet loss on interval change from 30s to 15s", () => {
        let lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId);
        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(true);

        lastPeriodTimestamp += 15000; // Begin new packet loss period 15s after previous period.
        pla.addPacketLossMeasurement(ssrcId, 0.05, lastPeriodTimestamp);
        pla.addPacketLossMeasurement(ssrcId, 0, lastPeriodTimestamp + 2000);

        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(false);
    });

    it("invalidates periodic packet loss measurements after a while", () => {
        jest.useFakeTimers();
        addPeriodicPacketLoss(pla, ssrcId);
        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(true);

        jest.runAllTimers();

        expect(pla.hasPeriodicPacketLoss(ssrcId)).toBe(false);
        jest.useRealTimers();
    });
});
