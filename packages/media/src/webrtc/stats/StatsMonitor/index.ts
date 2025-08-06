import { collectStats } from "./collectStats";
import { PressureObserver, startCpuObserver } from "./cpuObserver";
import { numFailedTrackSsrcLookups, numMissingTrackSsrcLookups } from "./peerConnection";

import { PressureRecord, StatsClient, ViewStats } from "../types";
import Logger from "../../../utils/Logger";

interface StatsMonitor {
    getUpdatedStats: () => Promise<Record<string, ViewStats> | undefined>;
    stop: () => void;
}

export interface StatsSubscription {
    onUpdatedStats: (statsByView: Record<string, ViewStats>, clients: StatsClient[]) => void;
}

export interface StatsMonitorState {
    currentMonitor: StatsMonitor | null;
    getClients: () => StatsClient[];
    lastPressureObserverRecord?: PressureRecord;
    lastUpdateTime: number;
    nextTimeout?: number;
    pressureObserver?: PressureObserver;
    statsByView: Record<string, ViewStats>;
    subscriptions: StatsSubscription[];
    numFailedStatsReports: number;
}

export interface StatsMonitorOptions {
    interval: number;
    logger: Pick<Logger, "debug" | "error" | "info" | "warn">;
}

const STATE: StatsMonitorState = {
    currentMonitor: null,
    getClients: () => [],
    lastUpdateTime: 0,
    statsByView: {},
    subscriptions: [],
    numFailedStatsReports: 0,
};

const OPTIONS: StatsMonitorOptions = {
    interval: 2000,
    logger: new Logger(),
};

export const getStats = () => {
    return { ...STATE.statsByView };
};

export const getNumFailedStatsReports = () => {
    return STATE.numFailedStatsReports;
};
export const getNumMissingTrackSsrcLookups = () => numMissingTrackSsrcLookups;
export const getNumFailedTrackSsrcLookups = () => numFailedTrackSsrcLookups;

export const getUpdatedStats = () => STATE.currentMonitor?.getUpdatedStats();

export const setClientProvider = (provider: () => StatsClient[]) => (STATE.getClients = provider);

function startStatsMonitor(state: StatsMonitorState, { interval, logger }: StatsMonitorOptions) {
    const collectStatsBound = collectStats.bind(null, state, { interval, logger });

    let cpuObserver: ReturnType<typeof startCpuObserver>;

    try {
        cpuObserver = startCpuObserver((records) => (state.lastPressureObserverRecord = records.pop()));
    } catch (ex) {
        logger.warn("Failed to observe CPU pressure", ex);
    }

    // initial run
    setTimeout(collectStatsBound, interval);

    return {
        getUpdatedStats: () => {
            return collectStatsBound(true);
        },
        stop: () => {
            clearTimeout(state.nextTimeout);
            cpuObserver?.stop();
        },
    };
}

export function subscribeStats(
    subscription: StatsSubscription,
    options: StatsMonitorOptions = OPTIONS,
    state: StatsMonitorState = STATE,
) {
    state.subscriptions.push(subscription);

    // start the monitor on first subscription
    if (!state.currentMonitor) state.currentMonitor = startStatsMonitor(state, options);

    return {
        stop() {
            state.subscriptions = state.subscriptions.filter((s) => s !== subscription);
            if (!state.subscriptions.length) {
                // stop monitor when last subscription is stopped/removed
                state.currentMonitor?.stop();
                state.currentMonitor = null;
            }
        },
    };
}
