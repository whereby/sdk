import Logger from "../../../utils/Logger";
import { collectStats } from "./collectStats";
import { startCpuObserver } from "./cpuObserver";

interface StatsMonitor {
    getUpdatedStats: () => Promise<Record<string, ViewStats> | undefined>;
    stop: () => void;
}

export interface StatsSubscription {
    onUpdatedStats: (statsByView: any, clients: any) => void;
}

export interface StatsMonitorState {
    currentMonitor: StatsMonitor | null;
    getClients: () => any[];
    lastPressureObserverRecord?: any;
    lastUpdateTime: number;
    nextTimeout?: number;
    pressureObserver?: any;
    statsByView: Record<string, ViewStats>;
    subscriptions: StatsSubscription[];
    numFailedStatsReports: number;
}

export interface StatsMonitorOptions {
    interval: number;
    logger: Pick<Logger, "debug" | "error" | "info" | "warn">;
}

export interface TrackStats {
    startTime: number;
    updated: number;
    ssrcs: Record<number, ssrcStats>;
}

export interface ViewStats {
    startTime?: number;
    updated?: number;
    pressure?: number | null;
    candidatePairs?: any;
    tracks: Record<string, TrackStats>;
}

export interface ssrcStats {
    startTime: number;
    updated: number;
    pcIndex: number;
    direction?: string;
    bitrate?: number;
    fractionLost?: number;
    height?: number;
    lossRatio?: number;
    pliRate?: number;
    fps?: number;
    audioLevel?: number;
    audioConcealment?: number;
    audioDeceleration?: number;
    audioAcceleration?: number;
    sourceHeight?: number;
    jitter?: number;
    roundTripTime?: number;
    codec?: string;
    byteCount?: number;
    kind?: string;
    ssrc?: number;
    mid?: number;
    rid?: string;
    nackCount?: number;
    nackRate?: number;
    packetCount?: number;
    packetRate?: number;
    headerByteCount?: number;
    mediaRatio?: number;
    sendDelay?: number;
    retransRatio?: number;
    width?: number;
    qualityLimitationReason?: string;
    pliCount?: number;
    firCount?: number;
    firRate?: number;
    kfCount?: number;
    kfRate?: number;
    frameCount?: number;
    qpf?: number;
    encodeTime?: number;
    sourceWidth?: number;
    sourceFps?: number;
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
