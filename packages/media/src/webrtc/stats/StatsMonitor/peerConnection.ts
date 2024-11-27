import rtcStats from "../../rtcStatsService";
import { getCurrentPeerConnections } from "./peerConnectionTracker";

// peer connection related data
const pcDataByPc = new WeakMap();
export let numMissingTrackSsrcLookups = 0;
export let numFailedTrackSsrcLookups = 0;

export const getPeerConnectionsWithStatsReports = () =>
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
                        numMissingTrackSsrcLookups++;
                        if (!pcData.ssrcToTrackId[ssrc]) {
                            pcData.ssrcToTrackId[ssrc] = "?" + ssrc;
                        }
                    });
                }
                return [pc, report, pcData];
            } catch (e: any) {
                rtcStats.sendEvent("trackSsrcLookupFailed", {
                    name: e?.name,
                    cause: e?.cause,
                    message: e?.message,
                });
                numFailedTrackSsrcLookups++;
                return [pc, [], pcData];
            }
        }),
    );
