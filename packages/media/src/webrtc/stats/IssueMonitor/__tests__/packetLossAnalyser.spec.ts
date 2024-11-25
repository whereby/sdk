import { PacketLossAnalyser } from "../packetLossAnalyser";

/**
 * Add periodic packet loss.
 */
const addPeriodicPacketLoss = (pla: PacketLossAnalyser, ssrcId: number, interval: number) => {
    let timestamp = Date.now();
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
    pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

    timestamp += interval * 1000;
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
    pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

    timestamp += interval * 1000;
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
    pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
    pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

    return timestamp;
};

describe("PacketLossAnalyser", () => {
    let pla: PacketLossAnalyser;
    const ssrcId = 12345;

    beforeEach(() => {
        pla = new PacketLossAnalyser();
    });

    it("reports no periodic packet loss on missing ssrc", () => {
        expect(pla.hasPeriodicPacketLoss(ssrcId, Date.now())).toBe(false);
    });

    it("reports periodic packet loss for 3 periods with equal interval", () => {
        const lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId, 60);
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(true);
    });

    it("reports periodic packet loss for 3 periods with some variation in interval", () => {
        let timestamp = Date.now();
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        timestamp += 60000; // Next packet loss period 60s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        timestamp += 61000; // Next packet loss period 61s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        expect(pla.hasPeriodicPacketLoss(ssrcId, timestamp + 4000)).toBe(true);

        timestamp += 59000; // Next packet loss period 59s after previous.
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp);
        pla.addPacketLossMeasurement(ssrcId, 0.05, timestamp + 2000);
        pla.addPacketLossMeasurement(ssrcId, 0, timestamp + 4000);

        expect(pla.hasPeriodicPacketLoss(ssrcId, timestamp + 4000)).toBe(true);
    });

    it("reports no periodic packet loss on interval change from 60s to 40s", () => {
        let lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId, 60);
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(true);

        lastPeriodTimestamp += 40000; // Begin new packet loss period 40s after previous period.
        pla.addPacketLossMeasurement(ssrcId, 0.05, lastPeriodTimestamp);
        pla.addPacketLossMeasurement(ssrcId, 0, lastPeriodTimestamp + 2000);

        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp + 2000)).toBe(false);
    });

    it("reports no periodic packet loss after a while when there are no new measurements", () => {
        jest.useFakeTimers();
        const lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId, 60);
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(true);

        jest.runAllTimers();

        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(false);
        jest.useRealTimers();
    });

    it("reports no periodic packet loss when previous interval is exceeded", () => {
        let lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId, 60);
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(true);

        lastPeriodTimestamp += 70000; // Past the 60s interval + our accepted diff.

        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(false);
    });

    it("reports no periodic packet loss for intervals shorter than 30s", () => {
        const lastPeriodTimestamp = addPeriodicPacketLoss(pla, ssrcId, 29);
        expect(pla.hasPeriodicPacketLoss(ssrcId, lastPeriodTimestamp)).toBe(false);
    });
});
