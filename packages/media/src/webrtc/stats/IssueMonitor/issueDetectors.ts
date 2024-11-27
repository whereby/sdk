import { ssrcStats, TrackStats, ViewStats } from "../StatsMonitor";
import { StatsClient } from "../types";
import { PacketLossAnalyser } from "./packetLossAnalyser";

interface IssueDetector {
    id: string;
    global?: boolean;
    enabled: (args: IssueCheckData) => boolean;
    check: (args: IssueCheckData) => boolean;
}

export interface IssueCheckData {
    client: StatsClient;
    clients: StatsClient[];
    kind: string;
    track: MediaStreamTrack | undefined;
    trackStats?: TrackStats;
    stats?: ViewStats;
    hasLiveTrack: boolean;
    ssrc0?: ssrcStats;
    ssrcs: ssrcStats[];
    issues: any;
    metrics: any;
}

const packetLossAnalyser = new PacketLossAnalyser();

export const periodicPacketLossDetector: IssueDetector = {
    id: "periodic-packet-loss",
    enabled: ({ client, hasLiveTrack, ssrc0 }) => {
        return (
            client.isLocalClient &&
            hasLiveTrack &&
            !!ssrc0?.ssrc &&
            ssrc0?.direction === "out" &&
            (ssrc0?.bitrate || 0) > 0
        );
    },
    check: ({ ssrc0 }) => {
        if (!ssrc0 || !ssrc0.ssrc) return false;
        packetLossAnalyser.addPacketLossMeasurement(ssrc0.ssrc, ssrc0.fractionLost || 0, Date.now());
        return packetLossAnalyser.hasPeriodicPacketLoss(ssrc0.ssrc, Date.now());
    },
};

export const badNetworkIssueDetector: IssueDetector = {
    id: "bad-network",
    enabled: ({ hasLiveTrack, ssrcs }) => hasLiveTrack && ssrcs.length > 0,
    check: ({ client, clients, kind, ssrcs }) => {
        const hasPositiveBitrate = ssrcs.some((ssrc) => (ssrc?.bitrate || 0) > 0);

        if (!hasPositiveBitrate && client.isLocalClient && kind === "video") {
            const remoteClients = clients.filter((c) => !c.isLocalClient);

            if (remoteClients.length > 0) {
                return !remoteClients.every((c) => c.isAudioOnlyModeEnabled);
            }
        }

        const ssrc0 = ssrcs[0];
        if (!ssrc0) {
            return false;
        }

        return (
            ssrc0.bitrate === 0 ||
            (ssrc0.lossRatio || 0) > 0.03 ||
            (ssrc0.fractionLost || 0) > 0.03 ||
            (!client.isPresentation && kind === "video" && !!ssrc0?.bitrate && ssrc0.bitrate < 30000) ||
            (ssrc0.direction === "in" && !!ssrc0.pliRate && ssrc0.pliRate > 2)
        );
    },
};

/**
 * A dry-track indicates that no media is being sent or received, which might indicata a problem.
 */
export const dryTrackIssueDetector: IssueDetector = {
    id: "dry-track",
    enabled: ({ hasLiveTrack, ssrcs }) => !!(hasLiveTrack && ssrcs),
    check: ({ client, clients, ssrcs }) => {
        /**
         * A client can be a remote one or the local one.
         *
         * Remote clients only have ssrcs for incoming rtp streams,
         * whereas the local client only has ssrcs for outgoing rtp streams
         *    |
         *    |--> In the case of p2p -> one ssrc per remote client
         *    |--> In the case of SFU -> one ssrc per simulcast layer
         *
         * In either case, we only detect "dry-track" if ALL ssrcs for one specific client
         * have bitrate 0, meaning no media is being sent/received.
         *
         * The exception is when the reason for zero bitrate is audio-only mode, meaning we
         * need to check the other clients.
         */
        let hasPositiveBitrate = false;

        ssrcs.forEach((ssrc) => {
            hasPositiveBitrate = hasPositiveBitrate || (ssrc?.bitrate || 0) > 0;
        });

        if (!hasPositiveBitrate && client.isLocalClient) {
            const remoteClients = clients.filter((c) => !c.isLocalClient);

            if (remoteClients.length > 0) {
                return !remoteClients.every((c) => c.isAudioOnlyModeEnabled);
            }
        }

        return !hasPositiveBitrate;
    },
};

export const noTrackIssueDetector: IssueDetector = {
    id: "no-track",
    enabled: () => true,
    check: ({ client, clients, kind, track }) => {
        if (!track && !client.isLocalClient && kind === "video") {
            const localClient = clients.find((c) => c.isLocalClient);
            if (localClient) {
                return !localClient.isAudioOnlyModeEnabled;
            }
        }

        return !track;
    },
};

export const noTrackStatsIssueDetector: IssueDetector = {
    id: "no-track-stats",
    enabled: ({ hasLiveTrack }) => hasLiveTrack,
    check: ({ client, clients, kind, ssrcs }) => {
        if (ssrcs.length === 0 && !client.isLocalClient && kind === "video") {
            const localClient = clients.find((c) => c.isLocalClient);
            if (localClient) {
                return !localClient.isAudioOnlyModeEnabled;
            }
        }

        return ssrcs.length === 0;
    },
};

export const issueDetectors: IssueDetector[] = [
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
        check: ({ stats }) => {
            if (!stats) return false;
            const jitter = {
                audio: 0,
                video: 0,
            };

            Object.values(stats.tracks)
                .flatMap((t) => Object.values(t.ssrcs))
                .forEach((ssrc) => {
                    if (ssrc.kind === "audio" && !!ssrc.jitter && ssrc.jitter > jitter.audio)
                        jitter.audio = ssrc.jitter;
                    if (ssrc.kind === "video" && !!ssrc.jitter && ssrc.jitter > jitter.video)
                        jitter.video = ssrc.jitter;
                });
            const diff = Math.abs(jitter.audio * 1000 - jitter.video * 1000); // diff in ms
            return diff > 500;
        },
    },
    noTrackIssueDetector,
    {
        id: "ended-track",
        enabled: ({ track }) => !!track,
        check: ({ track }) => track?.readyState === "ended",
    },
    noTrackStatsIssueDetector,
    dryTrackIssueDetector,
    {
        id: "low-layer0-bitrate",
        enabled: ({ hasLiveTrack, ssrc0, kind, client }) =>
            hasLiveTrack && kind === "video" && !!ssrc0 && !!ssrc0?.height && !client.isPresentation,
        check: ({ ssrc0 }) => {
            if (!ssrc0?.bitrate) return false;
            return (ssrc0?.height || 0) < 200 && ssrc0.bitrate < 30000;
        },
    },
    {
        id: "quality-limitation-bw",
        enabled: ({ hasLiveTrack, stats, client, kind }) =>
            hasLiveTrack && client.isLocalClient && kind === "video" && !!stats,
        check: ({ stats }) => {
            if (!stats) return false;
            return !!Object.values(stats.tracks).find((track) =>
                Object.values(track.ssrcs).find((ssrc) => ssrc.qualityLimitationReason === "bandwidth"),
            );
        },
    },
    {
        id: "quality-limitation-cpu",
        enabled: ({ hasLiveTrack, stats, client, kind }) =>
            hasLiveTrack && client.isLocalClient && kind === "video" && !!stats,
        check: ({ stats }) => {
            if (!stats) return false;
            return !!Object.values(stats.tracks).find((track) =>
                Object.values(track.ssrcs).find((ssrc) => ssrc.qualityLimitationReason === "cpu"),
            );
        },
    },
    {
        id: "high-plirate",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && !!ssrc0.height,
        check: ({ ssrc0 }) => (ssrc0?.pliRate || 0) > 2,
    },
    {
        id: "extreme-plirate",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && !!ssrc0.height,
        check: ({ ssrc0 }) => (ssrc0?.pliRate || 0) > 5,
    },
    {
        id: "high-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && ssrc0.direction === "in",
        check: ({ ssrc0 }) => (ssrc0?.lossRatio || 0) > 0.02,
    },
    {
        id: "extreme-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && ssrc0.direction === "in",
        check: ({ ssrc0 }) => (ssrc0?.lossRatio || 0) > 0.1,
    },
    {
        id: "high-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && ssrc0.direction === "out",
        check: ({ ssrc0 }) => (ssrc0?.fractionLost || 0) > 0.02,
    },
    {
        id: "extreme-packetloss",
        enabled: ({ hasLiveTrack, ssrc0 }) => hasLiveTrack && !!ssrc0 && ssrc0.direction === "out",
        check: ({ ssrc0 }) => (ssrc0?.fractionLost || 0) > 0.1,
    },
    {
        id: "fps-below-20",
        enabled: ({ hasLiveTrack, ssrc0, kind, client }) =>
            hasLiveTrack && !!ssrc0 && !!ssrc0.height && kind === "video" && !client.isPresentation,
        check: ({ ssrc0 }) => (ssrc0?.height || 0) > 180 && (ssrc0?.fps || 0) < 20,
    },
    {
        id: "fps-below-10",
        enabled: ({ hasLiveTrack, ssrc0, kind, client }) =>
            hasLiveTrack && !!ssrc0 && !!ssrc0.height && kind === "video" && !client.isPresentation,
        check: ({ ssrc0 }) => (ssrc0?.fps || 0) < 10,
    },
    badNetworkIssueDetector,
    periodicPacketLossDetector,
    {
        id: "cpu-pressure-serious",
        global: true,
        enabled: ({ stats }) => stats?.pressure?.source === "cpu",
        check: ({ stats }) => stats?.pressure?.state === "serious",
    },
    {
        id: "cpu-pressure-critical",
        global: true,
        enabled: ({ stats }) => stats?.pressure?.source === "cpu",
        check: ({ stats }) => stats?.pressure?.state === "critical",
    },
    {
        id: "concealed",
        enabled: ({ hasLiveTrack, ssrc0, kind }) => hasLiveTrack && !!ssrc0 && kind === "audio",
        check: ({ ssrc0 }) =>
            !!ssrc0?.bitrate &&
            ssrc0?.direction === "in" &&
            (ssrc0?.audioLevel || 0) >= 0.001 &&
            (ssrc0?.audioConcealment || 0) >= 0.1,
    },
    {
        id: "decelerated",
        enabled: ({ hasLiveTrack, ssrc0, kind }) => hasLiveTrack && !!ssrc0 && kind === "audio",
        check: ({ ssrc0 }) =>
            !!ssrc0?.bitrate &&
            ssrc0.direction === "in" &&
            (ssrc0.audioLevel || 0) >= 0.001 &&
            (ssrc0?.audioDeceleration || 0) >= 0.1,
    },
    {
        id: "accelerated",
        enabled: ({ hasLiveTrack, ssrc0, kind }) => hasLiveTrack && !!ssrc0 && kind === "audio",
        check: ({ ssrc0 }) =>
            !!ssrc0?.bitrate &&
            ssrc0.direction === "in" &&
            (ssrc0.audioLevel || 0) >= 0.001 &&
            (ssrc0.audioAcceleration || 0) >= 0.1,
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
