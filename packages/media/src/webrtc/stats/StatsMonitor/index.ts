import Logger from "../../../utils/Logger";
import { collectStats } from "./collectStats";
import { startCpuObserver } from "./cpuObserver";

interface StatsMonitor {
    getUpdatedStats: () => any;
    stop: () => void;
}

interface StatsSubscription {
    onUpdatedStats: (statsByView: any, clients: any) => void;
}
export interface StatsMonitorState {
    currentMonitor: StatsMonitor | null;
    getClients: () => any[];
    lastPressureObserverRecord?: any;
    lastUpdateTime: number;
    nextTimeout?: NodeJS.Timeout;
    pressureObserver?: any;
    statsByView: any;
    subscriptions: StatsSubscription[];
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
};

const OPTIONS: StatsMonitorOptions = {
    interval: 2000,
    logger: new Logger(),
};

export const getStats = () => {
    return { ...STATE.statsByView };
};

export const getUpdatedStats = () => STATE.currentMonitor?.getUpdatedStats();

export const setClientProvider = (provider: any) => (STATE.getClients = provider);

function startStatsMonitor(state: StatsMonitorState, { interval, logger }: StatsMonitorOptions) {
    const collectStatsBound = collectStats.bind(null, state, { interval, logger });

    let cpuObserver: any;

    try {
        cpuObserver = startCpuObserver((records: any) => (state.lastPressureObserverRecord = records.pop()));
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
            if (cpuObserver) cpuObserver.stop();
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
