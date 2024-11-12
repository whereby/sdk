import { Logger } from "../../../utils";

type PacketLossPeriod = {
    begin: number;
    end?: number;
};

type PacketLossHistory = {
    id: string;
    hasPeriodicPacketLoss: boolean;
    hasActivePacketLoss: boolean;
    currPeriod?: PacketLossPeriod;
    prevPeriod?: PacketLossPeriod;
    prevIntervalInMs?: number;
};

const logger = new Logger();
const debugLogger = {
    // eslint-disable-next-line no-console
    print: (...args: any[]) => console.log(args[0], ...args.slice(1)),
};
logger.withDebugLogger(debugLogger);

export class PacketLossAnalyser {
    private PACKET_LOSS_PERIOD_THRESHOLD = 0.03;
    private INTERVAL_DIFF_THRESHOLD_MS = 5000;
    private STALE_MEASUREMENT_TIMEOUT_MS = 10000;
    ssrcsHistory = new Map<string, PacketLossHistory>();
    private staleMeasurementTimeouts = new Map<string, NodeJS.Timeout>();

    addPacketLossMeasurement(id: string, packetLoss: number, timestamp: number) {
        logger.debug("addPacketLossMeasurement() [ssrcId: %s, loss: %s, timestamp: %s]", id, packetLoss, timestamp);
        this.handleStaleMeasurements(id);
        const hasPacketLoss = packetLoss > this.PACKET_LOSS_PERIOD_THRESHOLD;

        let history = this.ssrcsHistory.get(id);
        if (!history) {
            // This is the first time we see this ssrc.
            history = {
                id,
                hasActivePacketLoss: hasPacketLoss,
                currPeriod: hasPacketLoss ? { begin: timestamp } : undefined,
                hasPeriodicPacketLoss: false,
            };
            this.ssrcsHistory.set(id, history);
            return;
        }

        if (history.hasActivePacketLoss) {
            if (!hasPacketLoss) {
                // Record the end of active ssrc packet loss period.
                this.endPacketLossPeriod(history, timestamp);
            }
            return;
        }

        if (hasPacketLoss) {
            // Record the beginning of a new ssrc packet loss period.
            history.hasActivePacketLoss = true;
            history.currPeriod = {
                begin: timestamp,
            };
        }
    }

    hasPeriodicPacketLoss(id: string) {
        return this.ssrcsHistory.get(id)?.hasPeriodicPacketLoss || false;
    }

    private handleStaleMeasurements(id: string) {
        const staleMeasurementTimeout = this.staleMeasurementTimeouts.get(id);
        if (staleMeasurementTimeout) {
            clearTimeout(staleMeasurementTimeout);
        }
        this.staleMeasurementTimeouts.set(
            id,
            setTimeout(() => {
                logger.debug("Invalidating measurements for ssrc: %s", id);
                this.ssrcsHistory.delete(id);
            }, this.STALE_MEASUREMENT_TIMEOUT_MS),
        );
    }

    private endPacketLossPeriod(history: PacketLossHistory, timestamp: number) {
        logger.debug("endPacketLossPeriod() [ssrcId: %s, timestamp: %s]", history.id, timestamp);
        if (!history.currPeriod) throw new Error("No packet loss period for " + history.id);
        if (!history.prevPeriod) {
            // This is the first packet loss period for this ssrc.
            history.prevPeriod = { ...history.currPeriod, end: timestamp };
        } else {
            // We have previous period(s) so let's record the interval.
            history.currPeriod.end = timestamp;
            this.addNewPacketLossInterval(history);
        }
        delete history.currPeriod;
        history.hasActivePacketLoss = false;
    }

    private addNewPacketLossInterval(history: PacketLossHistory) {
        logger.debug(
            "addNewPacketLossInterval() [ssrcId: %s, prevIntervalInMs: %s]",
            history.id,
            history.prevIntervalInMs,
        );
        if (!history.currPeriod || !history.prevPeriod) throw new Error("missing period timestamps");
        const prevPeriodCenter = this.calculatePeriodCenterTimestamp(history.prevPeriod);
        const currPeriodCenter = this.calculatePeriodCenterTimestamp(history.currPeriod);
        const currIntervalInMs = currPeriodCenter - prevPeriodCenter;
        if (history.prevIntervalInMs) {
            // We have two intervals recorded and can compare them for periodic packet loss.
            const intervalDiffInMs = Math.abs(history.prevIntervalInMs - currIntervalInMs);
            history.hasPeriodicPacketLoss = intervalDiffInMs < this.INTERVAL_DIFF_THRESHOLD_MS;
            logger.debug(
                "addNewPacketLossInterval() [hasPeriodicPacketLoss: %s, intervalDiffInMs: %s]",
                intervalDiffInMs < this.INTERVAL_DIFF_THRESHOLD_MS,
                intervalDiffInMs,
            );
        }
        history.prevIntervalInMs = currIntervalInMs;
        history.prevPeriod = history.currPeriod;
    }

    private calculatePeriodCenterTimestamp(period: PacketLossPeriod) {
        if (!period.end) throw new Error("Missing period end timestamp");
        return period.begin + (period.end - period.begin) / 2;
    }
}
