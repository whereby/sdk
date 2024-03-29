import { getCurrentPeerConnections, getPeerConnectionIndex, removePeerConnection } from "./peerConnectionTracker";
import {
    captureSsrcInfo,
    captureCommonSsrcMetrics,
    captureVideoSsrcMetrics,
    captureAudioSsrcMetrics,
    captureCandidatePairInfoMetrics,
} from "./metrics";
import Logger from "../../../utils/Logger";

const logger = new Logger();

const STATS_INTERVAL = 2000;

let getClients = () => [];
export const setClientProvider = (provider: any) => (getClients = provider);

const statsByView: any = {};
export const getStats = () => {
    return { ...statsByView };
};

let subscriptions: any = [];
let currentMonitor: any = null;

export const getUpdatedStats = () => currentMonitor?.getUpdatedStats();

const getOrCreateSsrcMetricsContainer = (time: number, pcIndex: any, clientId: string, trackId: any, ssrc: any) => {
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

const removeNonUpdatedStats = (time: number) => {
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

// peer connection related data
const pcDataByPc = new WeakMap();

const getPeerConnectionsWithStatsReports = () =>
    Promise.all(
        getCurrentPeerConnections().map(async (pc: any) => {
            let pcData = pcDataByPc.get(pc);
            if (!pcData) {
                pcData = { ssrcToTrackId: {} };
                pcDataByPc.set(pc, pcData);
            }

            try {
                const report = await pc.getStats();

                let missingSsrcs: any = null;

                report.forEach((stats: any) => {
                    if (stats.type === "inbound-rtp" || stats.type === "outbound-rtp") {
                        if (!stats.trackIdentifier && !pcData.ssrcToTrackId[stats.ssrc]) {
                            // try to lookup by media-source
                            if (stats.mediaSourceId) {
                                const mediaSourceStats = report.get(stats.mediaSourceId);
                                if (mediaSourceStats) {
                                    if (mediaSourceStats.trackIdentifier) {
                                        pcData.ssrcToTrackId[stats.ssrc] = mediaSourceStats.trackIdentifier;
                                    }
                                }
                            }

                            // try to lookup by deprecated stats
                            if (!pcData.ssrcToTrackId[stats.ssrc] && stats.trackId) {
                                const deprecatedTrackStats = report.get(stats.trackId);
                                if (deprecatedTrackStats) {
                                    if (deprecatedTrackStats.trackIdentifier) {
                                        pcData.ssrcToTrackId[stats.ssrc] = deprecatedTrackStats.trackIdentifier;
                                    }
                                }
                            }
                            if (!pcData.ssrcToTrackId[stats.ssrc]) {
                                // we need to lookup this ssrc by separate getStats calls
                                if (!missingSsrcs) missingSsrcs = [];
                                missingSsrcs.push(stats.ssrc);
                            }
                        }
                    }
                });

                if (missingSsrcs) {
                    // call getStats() on all senders and receivers to map missing ssrcs
                    const sendersAndReceivers = [...pc.getSenders(), ...pc.getReceivers()];
                    const reports = await Promise.all(sendersAndReceivers.map((o) => o.getStats()));
                    reports.forEach((tReport, index) => {
                        tReport.forEach((stats: any) => {
                            if (stats.type === "inbound-rtp" || stats.type === "outbound-rtp") {
                                pcData.ssrcToTrackId[stats.ssrc] = sendersAndReceivers[index].track.id;
                            }
                        });
                    });

                    // create fake track ids for anything not found
                    missingSsrcs.forEach((ssrc: any) => {
                        if (!pcData.ssrcToTrackId[ssrc]) {
                            pcData.ssrcToTrackId[ssrc] = "?" + ssrc;
                        }
                    });
                }
                return [pc, report, pcData];
            } catch (ex) {
                return [pc, [], pcData];
            }
        })
    );

let originTrialActivated = false;
function activateComputePressureOriginTrial() {
    if (originTrialActivated) return;

    const otMeta = document.createElement("meta");
    otMeta.httpEquiv = "origin-trial";

    // these tokens expire May 29th 2024
    if (/hereby\.dev/.test(document.location.hostname)) {
        // *.hereby.dev
        otMeta.content =
            "AkSNPHJw6EK08X0QU7kORnK9NABzRLAC7dqfXOwk5JwFAQG4Ey7WxLXxsnhieCgC1QHUdevE2EFICy7uBGDANwUAAABqeyJvcmlnaW4iOiJodHRwczovL2hlcmVieS5kZXY6NDQ0MyIsImZlYXR1cmUiOiJDb21wdXRlUHJlc3N1cmVfdjIiLCJleHBpcnkiOjE3MTY5NDA3OTksImlzU3ViZG9tYWluIjp0cnVlfQ==";
    } else {
        // *.whereby.com
        otMeta.content =
            "Asc2wu8KpSx648i932NICteQDFcB05yl2QUUSHD7AQo8JGP2Fp6FF91TvYVJBsKGzLMH349rysPw5q9tqPC/PAUAAABqeyJvcmlnaW4iOiJodHRwczovL3doZXJlYnkuY29tOjQ0MyIsImZlYXR1cmUiOiJDb21wdXRlUHJlc3N1cmVfdjIiLCJleHBpcnkiOjE3MTY5NDA3OTksImlzU3ViZG9tYWluIjp0cnVlfQ==";
    }
    document.head.append(otMeta);
    originTrialActivated = true;
}

function startStatsMonitor({ interval }: { interval?: any }) {
    let nextTimeout: any = 0;

    activateComputePressureOriginTrial();

    let pressureObserver: any;
    let lastPressureObserverRecord: any;

    try {
        if ("PressureObserver" in window) {
            pressureObserver = new (window.PressureObserver as any)(
                (records: any) => (lastPressureObserverRecord = records.pop()),
                {
                    sampleRate: 1,
                }
            );
            pressureObserver.observe("cpu");
        }
    } catch (ex) {
        logger.warn("Failed to observe CPU pressure", ex);
    }

    let lastUpdateTime = 0;

    const collectStats = async (immediate: any) => {
        try {
            // refresh provided clients before each run
            const clients = getClients();
            // general stats, and stats that cannot be matched to any client will be added to "selfview" / unknown
            const defaultClient = clients.find((c: any) => c.isLocalClient && !c.isPresentation) || { id: "unknown" };

            // default stats need to be initialized
            let defaultViewStats = statsByView[defaultClient.id];
            if (!defaultViewStats) {
                defaultViewStats = { tracks: {}, candidatePairs: {}, pressure: null };
                statsByView[defaultClient.id] = defaultViewStats;
            }

            // set pressure to last record received
            defaultViewStats.pressure = lastPressureObserverRecord;

            // throttle calls to ensure we get a diff from previous stats
            const timeSinceLastUpdate = Date.now() - lastUpdateTime;
            if (timeSinceLastUpdate < 400) {
                if (immediate) return statsByView;
                subscriptions.forEach((subscription: any) => subscription.onUpdatedStats?.(statsByView, clients));
                nextTimeout = setTimeout(collectStats, interval || STATS_INTERVAL);
                return;
            }

            // keep track of what has been updated this run
            lastUpdateTime = Date.now();

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
                    if (
                        currentRtcStats.type === "candidate-pair" &&
                        /inprogress|succeeded/.test(currentRtcStats.state)
                    ) {
                        const prevRtcStats = pcData._oldReport?.get(currentRtcStats.id);
                        const timeDiff = prevRtcStats
                            ? currentRtcStats.timestamp - prevRtcStats.timestamp
                            : STATS_INTERVAL;

                        const cpId = pcIndex + ":" + currentRtcStats.id;
                        let cpMetrics = defaultViewStats.candidatePairs[cpId];
                        if (!cpMetrics) {
                            cpMetrics = { startTime: lastUpdateTime, id: cpId };
                            defaultViewStats.candidatePairs[cpId] = cpMetrics;
                        }
                        captureCandidatePairInfoMetrics(cpMetrics, currentRtcStats, prevRtcStats, timeDiff, report);
                        cpMetrics.lastRtcStatsTime = lastUpdateTime;
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

                        const timeDiff = prevRtcStats
                            ? currentRtcStats.timestamp - prevRtcStats.timestamp
                            : STATS_INTERVAL;
                        const ssrcMetrics = getOrCreateSsrcMetricsContainer(
                            lastUpdateTime,
                            pcIndex,
                            client.id,
                            trackId,
                            ssrc
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
                            const clientView = statsByView[clientId];
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

            removeNonUpdatedStats(lastUpdateTime);

            // mark candidatepairs as active/inactive
            Object.entries(defaultViewStats.candidatePairs).forEach(([cpKey, cp]: any) => {
                const active = cp.lastRtcStatsTime === lastUpdateTime;
                cp.active = active;
                if (!active) {
                    cp.state = "old/inactive";
                    if (!cp.inactiveFromTime) cp.inactiveFromTime = lastUpdateTime;
                    else {
                        // delete candidate pair after a few secs
                        if (lastUpdateTime - cp.inactiveFromTime > 4000) {
                            delete defaultViewStats.candidatePairs[cpKey];
                        }
                    }
                }
            });

            if (immediate) {
                return statsByView;
            } else {
                subscriptions.forEach((subscription: any) => subscription.onUpdatedStats?.(statsByView, clients));
            }
        } catch (ex) {
            logger.warn(ex);
        }

        nextTimeout = setTimeout(collectStats, interval || STATS_INTERVAL);
    };

    // initial run
    setTimeout(collectStats, interval || STATS_INTERVAL);

    return {
        stop: () => {
            clearTimeout(nextTimeout);
            if (pressureObserver) pressureObserver.unobserve("cpu");
        },
        getUpdatedStats: () => {
            return collectStats(true);
        },
    };
}

export function subscribeStats(subscription: any) {
    subscriptions.push(subscription);

    // start the monitor on first subscription
    if (!currentMonitor) currentMonitor = startStatsMonitor({});

    return {
        stop() {
            subscriptions = subscriptions.filter((s: any) => s !== subscription);
            if (!subscriptions.length) {
                // stop monitor when last subscription is stopped/removed
                currentMonitor?.stop();
                currentMonitor = null;
            }
        },
    };
}
