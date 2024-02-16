import { subscribeStats } from "../StatsMonitor";

let subscriptions = [];
let stopStats = null;

const issueDetectors = [
    {
        id: "desync",
        enabled: ({ client, track, stats }) => {
            return (
                !client.isLocalClient &&
                track?.kind === "audio" &&
                typeof stats?.tracks === "object" &&
                Object.keys(stats.tracks).length > 1
            );
        },
        check: ({ stats: { tracks } }) => {
            const jitter = {
                audio: 0,
                video: 0,
            };

            Object.values(tracks)
                .flatMap((t) => Object.values(t.ssrcs))
                .forEach((ssrc) => {
                    if (ssrc.kind === "audio" && ssrc.jitter > jitter.audio) jitter.audio = ssrc.jitter;
                    if (ssrc.kind === "video" && ssrc.jitter > jitter.video) jitter.video = ssrc.jitter;
                });
            const diff = Math.abs(jitter.audio * 1000 - jitter.video * 1000); // diff in ms
            return diff > 500;
        },
    },
    {
        id: "no-track",
        check: ({ track }) => !track,
    },
    {
        id: "ended-track",
        enabled: ({ track }) => track,
        check: ({ track }) => track.readyState === "ended",
    },
    {
        id: "no-track-stats",
        enabled: ({ hasLiveTrack }) => hasLiveTrack,
        check: ({ ssrc0 }) => !ssrc0,
    },
    {
        id: "dry-track",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0,
        check: ({ ssrc0 }) => ssrc0.bitrate === 0,
    },
    {
        id: "low-layer0-bitrate",
        enabled: ({ hasLiveTrack, ssrc0, kind, client }) =>
            hasLiveTrack && kind === "video" && ssrc0 && ssrc0.height && !client.isPresentation,
        check: ({ ssrc0 }) => ssrc0.height < 200 && ssrc0.bitrate < 30000,
    },
    {
        id: "quality-limitation-bw",
        enabled: ({ hasLiveTrack, stats, client, kind }) =>
            hasLiveTrack && client.isLocalClient && kind === "video" && stats,
        check: ({ stats }) =>
            Object.values(stats.tracks).find((track) =>
                Object.values(track.ssrcs).find((ssrc) => ssrc.qualityLimitationReason === "bandwidth")
            ),
    },
    {
        id: "quality-limitation-cpu",
        enabled: ({ hasLiveTrack, stats, client, kind }) =>
            hasLiveTrack && client.isLocalClient && kind === "video" && stats,
        check: ({ stats }) =>
            Object.values(stats.tracks).find((track) =>
                Object.values(track.ssrcs).find((ssrc) => ssrc.qualityLimitationReason === "cpu")
            ),
    },
    {
        id: "high-plirate",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.height,
        check: ({ ssrc0 }) => ssrc0.pliRate > 2,
    },
    {
        id: "extreme-plirate",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.height,
        check: ({ ssrc0 }) => ssrc0.pliRate > 5,
    },
    {
        id: "high-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.direction === "in",
        check: ({ ssrc0 }) => ssrc0.lossRatio > 0.02,
    },
    {
        id: "extreme-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.direction === "in",
        check: ({ ssrc0 }) => ssrc0.lossRatio > 0.1,
    },
    {
        id: "high-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.direction === "out",
        check: ({ ssrc0 }) => (ssrc0.fractionLost || 0) > 0.02,
    },
    {
        id: "extreme-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.direction === "out",
        check: ({ ssrc0 }) => (ssrc0.fractionLost || 0) > 0.1,
    },
    {
        id: "fps-below-20",
        enabled: ({ hasLiveTrack, ssrc0, kind, client }) =>
            hasLiveTrack && ssrc0 && ssrc0.height && kind === "video" && !client.isPresentation,
        check: ({ ssrc0 }) => ssrc0.height > 180 && ssrc0.fps < 20,
    },
    {
        id: "fps-below-10",
        enabled: ({ hasLiveTrack, ssrc0, kind, client }) =>
            hasLiveTrack && ssrc0 && ssrc0.height && kind === "video" && !client.isPresentation,
        check: ({ ssrc0 }) => ssrc0.fps < 10,
    },
    {
        id: "bad-network",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0,
        check: ({ ssrc0, kind, client }) =>
            ssrc0.bitrate === 0 ||
            ssrc0.lossRatio > 0.03 ||
            (ssrc0.fractionLost || 0) > 0.03 ||
            (!client.isPresentation && kind === "video" && ssrc0.bitrate < 30000) ||
            (ssrc0.direction === "in" && ssrc0.pliRate > 2),
    },
    {
        id: "cpu-pressure-serious",
        global: true,
        enabled: ({ stats }) => stats?.pressure?.source === "cpu",
        check: ({ stats }) => stats.pressure.state === "serious",
    },
    {
        id: "cpu-pressure-critical",
        global: true,
        enabled: ({ stats }) => stats?.pressure?.source === "cpu",
        check: ({ stats }) => stats.pressure.state === "critical",
    },
    {
        id: "concealed",
        enabled: ({ hasLiveTrack, ssrc0, kind }) => hasLiveTrack && ssrc0 && kind === "audio",
        check: ({ ssrc0 }) =>
            ssrc0.bitrate && ssrc0.direction === "in" && ssrc0.audioLevel >= 0.001 && ssrc0.audioConcealment >= 0.1,
    },
    {
        id: "decelerated",
        enabled: ({ hasLiveTrack, ssrc0, kind }) => hasLiveTrack && ssrc0 && kind === "audio",
        check: ({ ssrc0 }) =>
            ssrc0.bitrate && ssrc0.direction === "in" && ssrc0.audioLevel >= 0.001 && ssrc0.audioDeceleration >= 0.1,
    },
    {
        id: "accelerated",
        enabled: ({ hasLiveTrack, ssrc0, kind }) => hasLiveTrack && ssrc0 && kind === "audio",
        check: ({ ssrc0 }) =>
            ssrc0.bitrate && ssrc0.direction === "in" && ssrc0.audioLevel >= 0.001 && ssrc0.audioAcceleration >= 0.1,
    },
    // todo:
    // jitter/congestion - increasing jitter for several "ticks"
    // encodeTime?
    // low audio (energy)?
    // keyframe rate?
    // canidate-pair switches
    // RTT?
    // stun req/res
    // available bitrates
    // probes? low media bitrate?
    // match with wanted resolution/layer (updateStreamResolution)
    // might want to take window focus into consideration
];

const metrics = [
    {
        id: "bitrate",
        enabled: ({ hasLiveTrack, track, ssrc0 }) => hasLiveTrack && track && ssrc0,
        value: ({ trackStats }) => Object.values(trackStats.ssrcs).reduce((sum, ssrc) => sum + ssrc.bitrate, 0),
    },
    {
        id: "pixelrate",
        enabled: ({ hasLiveTrack, track, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && track && ssrc0 && ssrc0.height,
        value: ({ trackStats }) =>
            Object.values(trackStats.ssrcs).reduce(
                (sum, ssrc) => sum + (ssrc.fps || 0) * (ssrc.width || 0) * (ssrc.height || 0),
                0
            ),
    },
    {
        id: "height",
        enabled: ({ hasLiveTrack, track, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && track && ssrc0 && ssrc0.height,
        value: ({ trackStats }) =>
            Object.values(trackStats.ssrcs).reduce((max, ssrc) => Math.max(max, ssrc.fps > 0 ? ssrc.height : 0), 0),
    },
    {
        id: "sourceHeight",
        enabled: ({ hasLiveTrack, track, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && track && ssrc0 && ssrc0.sourceHeight && ssrc0.direction === "out",
        value: ({ ssrc0 }) => ssrc0.sourceHeight,
    },
    {
        id: "packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.bitrate,
        value: ({ ssrc0 }) => (ssrc0.direction === "in" ? ssrc0.lossRatio : ssrc0.fractionLost) || 0,
    },
    {
        id: "jitter",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.bitrate && ssrc0.direction === "in",
        value: ({ ssrc0 }) => ssrc0.jitter,
    },
    {
        // https://www.pingman.com/kb/article/how-is-mos-calculated-in-pingplotter-pro-50.html
        // I'm sceptical of this, we should validate this number makes sense, if not remove it
        id: "mos",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && ssrc0 && ssrc0.bitrate && ssrc0.direction === "out",
        value: ({ ssrc0 }) => {
            const averageLatency = ssrc0.roundTripTime || 0;
            const jitter = ssrc0.jitter || 0;
            const packetLoss = (ssrc0.fractionLost || 0) * 100;

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
        value: ({ stats }) => ({ nominal: 0.25, fair: 0.5, serious: 0.75, critical: 1 })[stats.pressure.state] || 0,
    },
    {
        id: "concealment",
        enabled: ({ hasLiveTrack, ssrc0, kind }) =>
            hasLiveTrack &&
            ssrc0 &&
            ssrc0.bitrate &&
            ssrc0.direction === "in" &&
            kind === "audio" &&
            ssrc0.audioLevel >= 0.001,
        value: ({ ssrc0 }) => ssrc0.audioConcealment,
    },
    {
        id: "deceleration",
        enabled: ({ hasLiveTrack, ssrc0, kind }) =>
            hasLiveTrack &&
            ssrc0 &&
            ssrc0.bitrate &&
            ssrc0.direction === "in" &&
            kind === "audio" &&
            ssrc0.audioLevel >= 0.001,
        value: ({ ssrc0 }) => ssrc0.audioDeceleration,
    },
    {
        id: "acceleration",
        enabled: ({ hasLiveTrack, ssrc0, kind }) =>
            hasLiveTrack &&
            ssrc0 &&
            ssrc0.bitrate &&
            ssrc0.direction === "in" &&
            kind === "audio" &&
            ssrc0.audioLevel >= 0.001,
        value: ({ ssrc0 }) => ssrc0.audioAcceleration,
    },
    {
        id: "qpf",
        enabled: ({ hasLiveTrack, track, ssrc0, kind }) =>
            hasLiveTrack && kind === "video" && track && ssrc0 && ssrc0.height,
        value: ({ trackStats }) => Object.values(trackStats.ssrcs).reduce((sum, ssrc) => sum + (ssrc.qpf || 0), 0),
    },
];

let aggregatedMetrics;
let aggregatedIssues;
let issuesAndMetricsByView;

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

function onUpdatedStats(statsByView, clients) {
    // reset aggregated current metrics
    Object.values(aggregatedMetrics).forEach((metricData) => {
        metricData.curTicks = 0;
        metricData.curSum = 0;
        metricData.curMax = 0;
        metricData.curMin = 0;
        metricData.curAvg = 0;
    });

    // reset aggregated current issues
    Object.values(aggregatedIssues).forEach((issueData) => {
        issueData.curTicks = 0;
        issueData.curRegistered = 0;
        issueData.active = false;
    });

    // skip detection and aggregation when alone in room
    if (!clients.find((client) => !client.isLocalClient)) return;

    clients.forEach((client) => {
        const stats = statsByView[client.id];

        ["video", "audio", "global"].forEach((kind) => {
            // skip checking muted/disabled tracks if not global
            if (!(kind === "global" && !client.isPresentation) && !client[kind]?.enabled) return;
            // don't check global for remote clients
            if (kind === "global" && !client.isLocalClient) return;

            let issuesAndMetrics = issuesAndMetricsByView[client.id];
            if (!issuesAndMetrics) {
                issuesAndMetrics = { issues: {}, metrics: {} };
                issuesAndMetricsByView[client.id] = issuesAndMetrics;
            }

            const track = client[kind]?.track;
            const hasLiveTrack = track && track.readyState !== "ended";

            const trackStats = track && stats && stats.tracks[track.id];
            const ssrcs =
                trackStats &&
                Object.values(trackStats.ssrcs).sort(
                    (a, b) => (a.height || Number.MAX_SAFE_INTEGER) - (b.height || Number.MAX_SAFE_INTEGER)
                );
            const ssrc0 = trackStats && ssrcs[0];

            const checkData = {
                client,
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
                            ticks: 0, // ticks beeing enabled
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

                const enabled = issueDetector.enabled ? issueDetector.enabled(checkData) : true;

                let issueData = issuesAndMetrics.issues[issueKey];
                let aggregatedIssueData = aggregatedIssues[issueKey];

                if (enabled) {
                    if (!issueData) {
                        issueData = {
                            active: false,
                            ticks: 0, // ticks beeing enabled
                            registered: 0, // ticks beeing registered (as an issue)
                            initial: 0, // ticks beeing registered initially
                            periods: 0, // number of periods this beeing registered
                            current: 0, // current period this beeing registered ticks
                            longest: 0, // longest number of period this beeing registered
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

                    const issueDetected = issueDetector.check?.(checkData);
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

    Object.values(aggregatedMetrics).forEach((aggregatedMetricData) => {
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

    Object.values(aggregatedIssues).forEach((aggregateIssueData) => {
        if (aggregateIssueData.curTicks) {
            // todo: maybe calculate some concurrent info for this issue
        }
    });

    subscriptions.forEach((subscription) =>
        subscription.onUpdatedIssues?.(issuesAndMetricsByView, statsByView, clients)
    );
}

export function subscribeIssues(subscription) {
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
