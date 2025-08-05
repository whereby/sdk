import { StatsSubscription, subscribeStats, ViewStats } from "../StatsMonitor";
import { StatsClient } from "../types";
import { IssueCheckData, issueDetectors } from "./issueDetectors";

let subscriptions: any[] = [];
let stopStats: (() => void) | null = null;

interface Metric {
    id: string;
    global?: true;
    enabled?: (checkData: IssueCheckData) => boolean;
    value: (checkData: IssueCheckData) => any;
}

interface MetricData {
    ticks: number; // ticks being enabled
    sum: number; // sum of metric
    avg: number; // avg
    min: number;
    max: number;
}

interface MetricDataAggregated {
    // all time
    ticks: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    // current / right now
    curTicks: number;
    curMin: number;
    curMax: number;
    curAvg: number;
    curSum: number;
    // total, sum of all concurrent
    totTicks: number;
    totMin: number;
    totMax: number;
    totAvg: number;
    totSum: number; // same as sum
}

type AggregatedMetrics = {
    [aggregatedMetricKey: string]: MetricDataAggregated;
};

interface IssueData {
    active: boolean;
    ticks: number; // ticks being enabled
    registered: number; // ticks being registered (as an issue)
    initial: number; // ticks being registered initially
    periods: number; // number of periods this being registered
    current: number; // current period this being registered ticks
    longest: number; // longest number of period this being registered
}

interface IssueDataAggregated {
    active: boolean;
    ticks: number;
    registered: number;
    initial: number;
    curTicks: number;
    curRegistered: number;
}

type AggregatedIssues = {
    [aggregatedIssueKey: string]: IssueDataAggregated;
};

type IssuesAndMetrics = {
    issues: { [issueKey: string]: IssueData };
    metrics: { [metricKey: string]: MetricData };
};

type IssuesAndMetricsAggregated = {
    issues: AggregatedIssues;
    metrics: AggregatedMetrics;
};

export type IssuesAndMetricsByView = {
    [clientId: string]: IssuesAndMetrics | IssuesAndMetricsAggregated;
    aggregated: IssuesAndMetricsAggregated;
};

const metrics: Metric[] = [
    {
        id: "bitrate",
        enabled: ({ hasLiveTrack, track, ssrc0 }) => hasLiveTrack && !!track && !!ssrc0,
        value: ({ trackStats }) =>
            Object.values(trackStats?.ssrcs || {}).reduce((sum: number, ssrc) => sum + (ssrc?.bitrate || 0), 0),
    },
    {
        id: "pixelrate",
        enabled: ({ hasLiveTrack, track, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && !!track && !!ssrc0 && !!ssrc0.height,
        value: ({ trackStats }) =>
            Object.values(trackStats?.ssrcs || {}).reduce(
                (sum: number, ssrc: any) => sum + (ssrc.fps || 0) * (ssrc.width || 0) * (ssrc.height || 0),
                0,
            ),
    },
    {
        id: "height",
        enabled: ({ hasLiveTrack, track, trackStats, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && !!trackStats && !!track && !!ssrc0 && !!ssrc0.height,
        value: ({ trackStats }) =>
            Object.values(trackStats?.ssrcs || {}).reduce(
                (max: number, ssrc: any) => Math.max(max, ssrc.fps > 0 ? ssrc.height : 0),
                0,
            ),
    },
    {
        id: "sourceHeight",
        enabled: ({ hasLiveTrack, track, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && !!track && !!ssrc0 && !!ssrc0.sourceHeight && ssrc0.direction === "out",
        value: ({ ssrc0 }) => ssrc0?.sourceHeight,
    },
    {
        id: "packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && !!ssrc0.bitrate,
        value: ({ ssrc0 }) => (ssrc0?.direction === "in" ? ssrc0.lossRatio : ssrc0?.fractionLost) || 0,
    },
    {
        id: "jitter",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && !!ssrc0.bitrate && ssrc0.direction === "in",
        value: ({ ssrc0 }) => ssrc0?.jitter,
    },
    {
        // https://www.pingman.com/kb/article/how-is-mos-calculated-in-pingplotter-pro-50.html
        // I'm sceptical of this, we should validate this number makes sense, if not remove it
        id: "mos",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && !!ssrc0.bitrate && ssrc0.direction === "out",
        value: ({ ssrc0 }) => {
            const averageLatency = ssrc0?.roundTripTime || 0;
            const jitter = ssrc0?.jitter || 0;
            const packetLoss = (ssrc0?.fractionLost || 0) * 100;

            const effectiveLatency = averageLatency + jitter * 2 + 10;
            let r = effectiveLatency < 160 ? 93.2 - effectiveLatency / 40 : 93.2 - (effectiveLatency - 120) / 10;
            r = r - packetLoss * 2.5;
            const mos = 1 + 0.035 * r + 0.000007 * r * (r - 60) * (100 - r);
            return mos;
        },
    },
    {
        id: "rendered",
        value: () => 1,
    },
    {
        id: "active",
        value: ({ hasLiveTrack, track, ssrc0 }) => (hasLiveTrack && track && ssrc0 ? 1 : 0),
    },
    {
        id: "cpu-pressure",
        global: true,
        enabled: ({ stats }) => stats?.pressure?.source === "cpu",
        value: ({ stats }) =>
            (({ nominal: 0.25, fair: 0.5, serious: 0.75, critical: 1 }) as any)[stats?.pressure?.state || ""] || 0,
    },
    {
        id: "turn-usage",
        global: true,
        enabled: ({ stats }) => !!Object.values(stats?.candidatePairs || {}).length,
        value: ({ stats }) => Object.values(stats?.candidatePairs || {}).some((cp: any) => cp.usingTurn),
    },
    {
        id: "turn-tls-usage",
        global: true,
        enabled: ({ stats }) => !!Object.values(stats?.candidatePairs || {}).length,
        value: ({ stats }) => Object.values(stats?.candidatePairs || {}).some((cp: any) => cp.turnProtocol === "tls"),
    },
    {
        id: "concealment",
        enabled: ({ hasLiveTrack, ssrc0, kind }) =>
            hasLiveTrack &&
            !!ssrc0 &&
            !!ssrc0.bitrate &&
            ssrc0.direction === "in" &&
            kind === "audio" &&
            (ssrc0.audioLevel || 0) >= 0.001,
        value: ({ ssrc0 }) => ssrc0?.audioConcealment,
    },
    {
        id: "deceleration",
        enabled: ({ hasLiveTrack, ssrc0, kind }) =>
            hasLiveTrack &&
            !!ssrc0 &&
            !!ssrc0.bitrate &&
            ssrc0.direction === "in" &&
            kind === "audio" &&
            (ssrc0.audioLevel || 0) >= 0.001,
        value: ({ ssrc0 }) => ssrc0?.audioDeceleration,
    },
    {
        id: "acceleration",
        enabled: ({ hasLiveTrack, ssrc0, kind }) =>
            hasLiveTrack &&
            !!ssrc0 &&
            !!ssrc0.bitrate &&
            ssrc0.direction === "in" &&
            kind === "audio" &&
            (ssrc0.audioLevel || 0) >= 0.001,
        value: ({ ssrc0 }) => ssrc0?.audioAcceleration,
    },
    {
        id: "qpf",
        enabled: ({ hasLiveTrack, track, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && !!track && !!ssrc0 && !!ssrc0.height,
        value: ({ trackStats }) =>
            Object.values(trackStats?.ssrcs || {}).reduce((sum: number, ssrc) => sum + (ssrc.qpf || 0), 0),
    },
];

let aggregatedMetrics: AggregatedMetrics;
let aggregatedIssues: AggregatedIssues;
let issuesAndMetricsByView: IssuesAndMetricsByView;

const initIssuesAndMetricsByView = () => {
    aggregatedMetrics = {};
    aggregatedIssues = {};

    issuesAndMetricsByView = {
        aggregated: {
            issues: aggregatedIssues,
            metrics: aggregatedMetrics,
        },
    };
};
initIssuesAndMetricsByView();

export const getIssuesAndMetrics = () => {
    return { ...issuesAndMetricsByView };
};

function onUpdatedStats(statsByView: Record<string, ViewStats>, clients: StatsClient[]) {
    // reset aggregated current metrics
    Object.values(aggregatedMetrics).forEach((metricData: MetricDataAggregated) => {
        metricData.curTicks = 0;
        metricData.curSum = 0;
        metricData.curMax = 0;
        metricData.curMin = 0;
        metricData.curAvg = 0;
    });

    // reset aggregated current issues
    Object.values(aggregatedIssues).forEach((issueData: IssueDataAggregated) => {
        issueData.curTicks = 0;
        issueData.curRegistered = 0;
        issueData.active = false;
    });

    // skip detection and aggregation when alone in room
    if (!clients.find((client) => !client.isLocalClient)) return;

    clients.forEach((client) => {
        const stats = statsByView[client.id];

        ["video", "audio", "global"].forEach((kind) => {
            // don't check global for remote clients
            if (kind === "global" && !client.isLocalClient) return;

            let issuesAndMetrics = issuesAndMetricsByView[client.id];
            if (!issuesAndMetrics) {
                issuesAndMetrics = { issues: {}, metrics: {} };
                issuesAndMetricsByView[client.id] = issuesAndMetrics;
            }

            const track = (client as any)[kind]?.track as MediaStreamTrack | undefined;
            const hasLiveTrack = !!track && track.readyState !== "ended";

            const trackStats = track && stats && stats.tracks[track.id];
            const ssrcs = trackStats
                ? Object.values(trackStats.ssrcs).sort(
                    (a: any, b: any) => (a.height || Number.MAX_SAFE_INTEGER) - (b.height || Number.MAX_SAFE_INTEGER),
                )
                : [];
            const ssrc0 = ssrcs[0];

            const checkData: IssueCheckData = {
                client,
                clients,
                kind,
                track,
                trackStats,
                stats,
                hasLiveTrack,
                ssrc0,
                ssrcs,
                issues: issuesAndMetrics.issues,
                metrics: issuesAndMetrics.metrics,
            };

            const qualifierString =
                kind === "global"
                    ? "global"
                    : `${client.isLocalClient ? "loc" : "rem"}-${client.isPresentation ? "pres" : "cam"}-${kind}`;

            metrics.forEach((metric) => {
                if (metric.global && kind !== "global") return;
                if (!metric.global && kind === "global") return;

                const enabled = metric.enabled ? metric.enabled(checkData) : true;
                if (enabled) {
                    const metricKey = `${qualifierString}-${metric.id}`;
                    let metricData = issuesAndMetrics.metrics[metricKey];
                    const value = metric.value(checkData);
                    if (!metricData) {
                        metricData = {
                            ticks: 0, // ticks being enabled
                            sum: 0, // sum of metric
                            avg: 0, // avg
                            min: value,
                            max: value,
                        };
                        issuesAndMetrics.metrics[metricKey] = metricData;
                    }
                    metricData.ticks++;
                    metricData.sum += value;
                    metricData.min = Math.min(metricData.min, value);
                    metricData.max = Math.max(metricData.max, value);
                    metricData.avg = metricData.sum / metricData.ticks;

                    let aggregatedMetricData = aggregatedMetrics[metricKey];
                    if (!aggregatedMetricData) {
                        aggregatedMetricData = {
                            // all time
                            ticks: 0,
                            sum: 0,
                            min: value,
                            max: value,
                            avg: 0,
                            // current / right now
                            curTicks: 0,
                            curMin: 0,
                            curMax: 0,
                            curAvg: 0,
                            curSum: 0,
                            // total, sum of all concurrent
                            totTicks: 0,
                            totMin: 0,
                            totMax: 0,
                            totAvg: 0,
                            totSum: 0, // same as sum
                        };
                        aggregatedMetrics[metricKey] = aggregatedMetricData;
                    }
                    aggregatedMetricData.ticks++;
                    aggregatedMetricData.sum += value;
                    aggregatedMetricData.min = Math.min(aggregatedMetricData.min, value);
                    aggregatedMetricData.max = Math.max(aggregatedMetricData.max, value);
                    aggregatedMetricData.avg = aggregatedMetricData.sum / aggregatedMetricData.ticks;

                    if (aggregatedMetricData.curTicks === 0) {
                        aggregatedMetricData.curMax = value;
                        aggregatedMetricData.curMin = value;
                        aggregatedMetricData.curSum = value;
                    } else {
                        aggregatedMetricData.curMax = Math.max(aggregatedMetricData.curMax, value);
                        aggregatedMetricData.curMin = Math.min(aggregatedMetricData.curMin, value);
                        aggregatedMetricData.curSum += value;
                    }
                    aggregatedMetricData.curTicks++;
                }
            });

            issueDetectors.forEach((issueDetector) => {
                if (issueDetector.global && kind !== "global") return;
                if (!issueDetector.global && kind === "global") return;

                const issueKey = `${qualifierString}-${issueDetector.id}`;

                const enabled = issueDetector.enabled(checkData);

                let issueData = issuesAndMetrics.issues[issueKey] as IssueData;
                let aggregatedIssueData = aggregatedIssues[issueKey] as IssueDataAggregated;

                if (enabled) {
                    if (!issueData) {
                        issueData = {
                            active: false,
                            ticks: 0, // ticks being enabled
                            registered: 0, // ticks being registered (as an issue)
                            initial: 0, // ticks being registered initially
                            periods: 0, // number of periods this being registered
                            current: 0, // current period this being registered ticks
                            longest: 0, // longest number of period this being registered
                        };
                        issuesAndMetrics.issues[issueKey] = issueData;
                    }

                    issueData.ticks++;

                    if (!aggregatedIssueData) {
                        aggregatedIssueData = {
                            active: false,
                            ticks: 0,
                            registered: 0,
                            initial: 0,
                            curTicks: 0,
                            curRegistered: 0,
                        };
                        aggregatedIssues[issueKey] = aggregatedIssueData;
                    }
                    aggregatedIssueData.ticks++;
                    aggregatedIssueData.curTicks++;

                    const issueDetected = issueDetector.check(checkData);
                    if (issueDetected) {
                        issueData.registered++;
                        issueData.current++;
                        if (!issueData.active) {
                            issueData.active = true;
                            issueData.periods++;
                        }
                        if (issueData.ticks === issueData.initial + 1) {
                            // this is detected initially
                            issueData.initial++;
                            aggregatedIssueData.initial++;
                        }

                        if (issueData.current > issueData.longest) issueData.longest = issueData.current;

                        aggregatedIssueData.active = true;
                        aggregatedIssueData.registered++;
                        aggregatedIssueData.curRegistered++;
                    } else {
                        issueData.active = false;
                        issueData.current = 0;
                    }
                } else {
                    if (issueData) {
                        issueData.active = false;
                        issueData.current = 0;
                    }
                }
            });
        });
    });

    Object.values(aggregatedMetrics).forEach((aggregatedMetricData: MetricDataAggregated) => {
        if (aggregatedMetricData.curTicks) {
            aggregatedMetricData.curAvg = aggregatedMetricData.curSum / aggregatedMetricData.curTicks;

            if (aggregatedMetricData.totTicks === 0) {
                aggregatedMetricData.totMin = aggregatedMetricData.curSum;
                aggregatedMetricData.totMax = aggregatedMetricData.curSum;
            }
            aggregatedMetricData.totTicks++;
            aggregatedMetricData.totSum += aggregatedMetricData.curSum;
            aggregatedMetricData.totMin = Math.min(aggregatedMetricData.totMin, aggregatedMetricData.curSum);
            aggregatedMetricData.totMax = Math.max(aggregatedMetricData.totMax, aggregatedMetricData.curSum);
            aggregatedMetricData.totAvg = aggregatedMetricData.totSum / aggregatedMetricData.totTicks;
        }
    });

    Object.values(aggregatedIssues).forEach((aggregateIssueData: IssueDataAggregated) => {
        if (aggregateIssueData.curTicks) {
            // todo: maybe calculate some concurrent info for this issue
        }
    });

    subscriptions.forEach((subscription) =>
        subscription.onUpdatedIssues?.(issuesAndMetricsByView, statsByView, clients),
    );
}

export function subscribeIssues(subscription: {
    onUpdatedIssues: (issuesAndMetricsByView: IssuesAndMetricsByView, statsByView: any, clients: any) => void;
}): { stop: () => void } {
    subscriptions.push(subscription);

    // start the stats on first subscription
    if (!stopStats) stopStats = subscribeStats({ onUpdatedStats }).stop;

    return {
        stop() {
            subscriptions = subscriptions.filter((s) => s !== subscription);
            if (!subscriptions.length) {
                // stop stats subscription when last is stopped/removed
                stopStats?.();
                stopStats = null;
                // reset metrics for tests
                initIssuesAndMetricsByView();
            }
        },
    };
}
