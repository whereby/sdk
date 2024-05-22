import { StatsMonitorOptions, StatsMonitorState } from ".";
import {
    captureSsrcInfo,
    captureCommonSsrcMetrics,
    captureVideoSsrcMetrics,
    captureAudioSsrcMetrics,
    captureCandidatePairInfoMetrics,
} from "./metrics";
import { getPeerConnectionsWithStatsReports } from "./peerConnection";
import { getPeerConnectionIndex, removePeerConnection } from "./peerConnectionTracker";

const getOrCreateSsrcMetricsContainer = (
    statsByView: any,
    time: number,
    pcIndex: any,
    clientId: string,
    trackId: any,
    ssrc: any,
) => {
    let viewStats = statsByView[clientId];
    if (!viewStats) {
        viewStats = { tracks: {}, startTime: time, updated: time };
        statsByView[clientId] = viewStats;
    }
    viewStats.updated = time;
    let trackStats = viewStats.tracks[trackId];
    if (!trackStats) {
        trackStats = { ssrcs: {}, startTime: time, updated: time };
        viewStats.tracks[trackId] = trackStats;
    }
    trackStats.updated = time;
    let ssrcStats = trackStats.ssrcs[ssrc];
    if (!ssrcStats) {
        ssrcStats = {
            startTime: time,
            updated: time,
            pcIndex,
        };
        trackStats.ssrcs[ssrc] = ssrcStats;
    }
    ssrcStats.updated = time;
    return ssrcStats;
};

const removeNonUpdatedStats = (statsByView: any, time: number) => {
    Object.entries(statsByView).forEach(([viewId, viewStats]: any) => {
        if (viewStats.updated < time) {
            delete statsByView[viewId];
        } else {
            Object.entries(viewStats.tracks).forEach(([trackId, trackStats]: any) => {
                if (trackStats.updated < time) {
                    delete viewStats.tracks[trackId];
                } else {
                    Object.entries(trackStats.ssrcs).forEach(([ssrc, ssrcStats]: any) => {
                        if (ssrcStats.updated < time) {
                            delete trackStats.ssrcs[ssrc];
                        }
                    });
                }
            });
        }
    });
};

export async function collectStats(
    state: StatsMonitorState,
    { logger, interval }: StatsMonitorOptions,
    immediate: any,
) {
    const collectStatsBound = collectStats.bind(null, state, { interval, logger });

    try {
        // refresh provided clients before each run
        const clients = state.getClients();
        // general stats, and stats that cannot be matched to any client will be added to "selfview" / unknown
        const defaultClient = clients.find((c: any) => c.isLocalClient && !c.isPresentation) || { id: "unknown" };

        // default stats need to be initialized
        let defaultViewStats = state.statsByView[defaultClient.id];
        if (!defaultViewStats) {
            defaultViewStats = { tracks: {}, candidatePairs: {}, pressure: null };
            state.statsByView[defaultClient.id] = defaultViewStats;
        }

        // set pressure to last record received
        defaultViewStats.pressure = state.lastPressureObserverRecord;

        // throttle calls to ensure we get a diff from previous stats
        const timeSinceLastUpdate = Date.now() - state.lastUpdateTime;
        if (timeSinceLastUpdate < 400) {
            if (immediate) return state.statsByView;
            state.subscriptions.forEach((subscription: any) =>
                subscription.onUpdatedStats?.(state.statsByView, clients),
            );
            state.nextTimeout = setTimeout(collectStatsBound, interval);
            return;
        }

        // keep track of what has been updated this run
        state.lastUpdateTime = Date.now();

        // loop through current peer connections
        (await getPeerConnectionsWithStatsReports()).forEach(([pc, report, pcData]) => {
            // each new peer connection will get +1, to be able to see/count/correlate data
            const pcIndex = getPeerConnectionIndex(pc);

            // for some reason, the close event isn't called always, so we clean up manually
            if (pc.connectionState === "closed") {
                report = new Map();
                removePeerConnection(pc);
            }

            // keep track of visited ssrcs for cleanup later
            pcData.previousSSRCs = pcData.currentSSRCs || {};
            pcData.currentSSRCs = {};

            // loop though each stats dictionary in report
            report.forEach((currentRtcStats: any) => {
                if (currentRtcStats.type === "candidate-pair" && /inprogress|succeeded/.test(currentRtcStats.state)) {
                    const prevRtcStats = pcData._oldReport?.get(currentRtcStats.id);
                    const timeDiff = prevRtcStats ? currentRtcStats.timestamp - prevRtcStats.timestamp : interval;

                    const cpId = pcIndex + ":" + currentRtcStats.id;
                    let cpMetrics = defaultViewStats.candidatePairs[cpId];
                    if (!cpMetrics) {
                        cpMetrics = { startTime: state.lastUpdateTime, id: cpId };
                        defaultViewStats.candidatePairs[cpId] = cpMetrics;
                    }
                    captureCandidatePairInfoMetrics(cpMetrics, currentRtcStats, prevRtcStats, timeDiff, report);
                    cpMetrics.lastRtcStatsTime = state.lastUpdateTime;
                }

                if (currentRtcStats.type === "inbound-rtp" || currentRtcStats.type === "outbound-rtp") {
                    const kind = currentRtcStats.mediaType || currentRtcStats.kind;
                    const ssrc = currentRtcStats.ssrc;

                    let trackId = currentRtcStats.trackIdentifier || pcData.ssrcToTrackId[ssrc];

                    let prevRtcStats = pcData._oldReport?.get(currentRtcStats.id);

                    // update trackId if mediasource changes
                    if (prevRtcStats && prevRtcStats.mediaSourceId !== currentRtcStats.mediaSourceId) {
                        const mediaSourceStats = report.get(currentRtcStats.mediaSourceId);
                        if (mediaSourceStats && mediaSourceStats.trackIdentifier) {
                            trackId = mediaSourceStats.trackIdentifier;
                            pcData.ssrcToTrackId[ssrc] = trackId;
                        }
                    }

                    // find the current client using this trackId, or default
                    const client = clients.find((c: any) => c[kind].track?.id === trackId) || defaultClient;

                    pcData.currentSSRCs[ssrc] = client.id;
                    // we need to stats reset when selected candidate pair changes
                    // todo: metrics should += diff, not use count directly
                    if (prevRtcStats) {
                        const newTransport = report.get(currentRtcStats.transportId);
                        const oldTransport = pcData._oldReport.get(prevRtcStats.transportId);
                        if (
                            oldTransport &&
                            newTransport?.selectedCandidatePairId !== oldTransport.selectedCandidatePairId
                        ) {
                            // new candidate-pair, rtp stats will reset
                            prevRtcStats = null;
                        } else if (
                            currentRtcStats.bytesReceived < prevRtcStats.bytesReceived ||
                            currentRtcStats.bytesSent < prevRtcStats.bytesSent
                        ) {
                            // appears rts stats has reset
                            prevRtcStats = null;
                        }
                    }

                    const timeDiff = prevRtcStats ? currentRtcStats.timestamp - prevRtcStats.timestamp : interval;
                    const ssrcMetrics = getOrCreateSsrcMetricsContainer(
                        state.statsByView,
                        state.lastUpdateTime,
                        pcIndex,
                        client.id,
                        trackId,
                        ssrc,
                    );

                    // capture tracks/ssrc info/metrics
                    captureSsrcInfo(ssrcMetrics, currentRtcStats, prevRtcStats, timeDiff, report);
                    captureCommonSsrcMetrics(ssrcMetrics, currentRtcStats, prevRtcStats, timeDiff, report);
                    if (kind === "video") {
                        captureVideoSsrcMetrics(ssrcMetrics, currentRtcStats, prevRtcStats, timeDiff, report);
                    }
                    if (kind === "audio") {
                        captureAudioSsrcMetrics(ssrcMetrics, currentRtcStats, prevRtcStats, timeDiff, report);
                    }
                }
            });

            pcData._oldReport = report;

            // clean up old stats/metrics
            Object.keys(pcData.previousSSRCs)
                .filter((ssrc) => !pcData.currentSSRCs[ssrc])
                .forEach((ssrc) => {
                    const clientId = pcData.previousSSRCs[ssrc];
                    if (clientId) {
                        // remove
                        const clientView = state.statsByView[clientId];
                        if (clientView) {
                            Object.values(clientView.tracks).forEach((trackStats: any) => {
                                if (trackStats.ssrcs[ssrc]) {
                                    delete trackStats.ssrcs[ssrc];
                                }
                            });
                        }
                    }
                });
        });

        removeNonUpdatedStats(state.statsByView, state.lastUpdateTime);

        // mark candidatepairs as active/inactive
        Object.entries(defaultViewStats.candidatePairs).forEach(([cpKey, cp]: any) => {
            const active = cp.lastRtcStatsTime === state.lastUpdateTime;
            cp.active = active;
            if (!active) {
                cp.state = "old/inactive";
                if (!cp.inactiveFromTime) cp.inactiveFromTime = state.lastUpdateTime;
                else {
                    // delete candidate pair after a few secs
                    if (state.lastUpdateTime - cp.inactiveFromTime > 4000) {
                        delete defaultViewStats.candidatePairs[cpKey];
                    }
                }
            }
        });

        if (immediate) {
            return state.statsByView;
        } else {
            state.subscriptions.forEach((subscription: any) =>
                subscription.onUpdatedStats?.(state.statsByView, clients),
            );
        }
    } catch (ex) {
        logger.warn(ex);
    }

    state.nextTimeout = setTimeout(collectStatsBound, interval);
}
