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
    print: (...args: any[]) => console.debug(args[0], ...args.slice(1)),
};
logger.withDebugLogger(debugLogger);

export class PacketLossAnalyser {
    private BEGIN_PACKET_LOSS_PERIOD_THRESHOLD = 0.04;
    private END_PACKET_LOSS_PERIOD_THRESHOLD = 0.005;
    private INTERVAL_DIFF_THRESHOLD_MS = 4000;
    private STALE_MEASUREMENT_TIMEOUT_MS = 10000;
    private MINIMUM_INTERVAL_MS = 30000;
    private ssrcsHistory = new Map<string, PacketLossHistory>();
    private staleMeasurementTimeouts = new Map<string, NodeJS.Timeout>();

    addPacketLossMeasurement(id: string, packetLoss: number, timestamp: number) {
        this.handleStaleMeasurements(id);
        const beginNewPacketLossPeriod = packetLoss > this.BEGIN_PACKET_LOSS_PERIOD_THRESHOLD;

        let history = this.ssrcsHistory.get(id);
        if (!history) {
            // This is the first time we see this ssrc.
            history = {
                id,
                hasActivePacketLoss: beginNewPacketLossPeriod,
                currPeriod: beginNewPacketLossPeriod ? { begin: timestamp } : undefined,
                hasPeriodicPacketLoss: false,
            };
            this.ssrcsHistory.set(id, history);
            return;
        }

        if (history.hasActivePacketLoss) {
            if (packetLoss < this.END_PACKET_LOSS_PERIOD_THRESHOLD) {
                this.endPacketLossPeriod(history, timestamp);
                if (history.prevIntervalInMs && history.prevIntervalInMs < this.MINIMUM_INTERVAL_MS) {
                    // Too short interval, delete measurements for ssrc and start over.
                    this.ssrcsHistory.delete(id);
                }
            }
            return;
        }

        if (beginNewPacketLossPeriod) {
            // Record the beginning of a new ssrc packet loss period.
            history.hasActivePacketLoss = true;
            history.currPeriod = {
                begin: timestamp,
            };
        }
    }

    hasPeriodicPacketLoss(id: string, timestamp: number) {
        const history = this.ssrcsHistory.get(id);

        // Reset state for ssrc if previous interval was exceeded.
        if (history && this.prevIntervalExceeded(history, timestamp)) {
            this.ssrcsHistory.delete(history.id);
            return false;
        }
        return history?.hasPeriodicPacketLoss || false;
    }

    private prevIntervalExceeded(history: PacketLossHistory, timestamp: number) {
        if (history.prevPeriod && history.prevIntervalInMs) {
            const intervalLimitTimestamp =
                this.calculatePeriodCenterTimestamp(history.prevPeriod) +
                history.prevIntervalInMs +
                this.INTERVAL_DIFF_THRESHOLD_MS;
            return timestamp > intervalLimitTimestamp;
        }
        return false;
    }

    private handleStaleMeasurements(id: string) {
        const staleMeasurementTimeout = this.staleMeasurementTimeouts.get(id);
        if (staleMeasurementTimeout) {
            clearTimeout(staleMeasurementTimeout);
        }
        this.staleMeasurementTimeouts.set(
            id,
            setTimeout(() => {
                logger.debug("handleStaleMeasurements() [measurements invalid for ssrc: %s]", id);
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
