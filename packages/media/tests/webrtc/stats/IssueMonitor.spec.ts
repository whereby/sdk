import { subscribeIssues } from "../../../src/webrtc/stats/IssueMonitor";
import { setClientProvider } from "../../../src/webrtc/stats/StatsMonitor";
import { setPeerConnectionsForTests } from "../../../src/webrtc/stats/StatsMonitor/peerConnectionTracker";

function createMockPeerConnection(clients: any) {
    return {
        getStats() {
            return new Map(
                clients
                    .flatMap((client: any) => [
                        client.audio.enabled && { ...client.audio.stats, timestamp: Date.now() },
                        client.video.enabled && { ...client.video.stats, timestamp: Date.now() },
                    ])
                    .filter(Boolean)
                    .map((stats: any) => [stats.id, { ...stats }])
            );
        },
    };
}

function createMockClient(id: any, isLocal: any) {
    return {
        id,
        isLocalClient: !!isLocal,
        audio: {
            enabled: true,
            track: { id: `${id}-audiotrack` },
            stats: {
                id: `${id}-audiostats`,
                kind: "audio",
                type: isLocal ? "outbound-rtp" : "inbound-rtp",
                trackIdentifier: `${id}-audiotrack`,
                ssrc: `${id}-audiossrc`,
                bytesSent: 0,
                headerBytesSent: 0,
                bytesReceived: 0,
                headerBytesReceived: 0,
            },
        },
        video: {
            enabled: true,
            track: { id: `${id}-videotrack` },
            stats: {
                id: `${id}-videostats`,
                kind: "video",
                type: isLocal ? "outbound-rtp" : "inbound-rtp",
                trackIdentifier: `${id}-videotrack`,
                ssrc: `${id}-videossrc`,
                bytesSent: 0,
                headerBytesSent: 0,
                bytesReceived: 0,
                headerBytesReceived: 0,
            },
        },
        isPresentation: false,
    };
}

describe("IssueMonitor", () => {
    let stopSubscription: any;
    let localCam: any;
    let remoteCam1: any;
    let remoteCam2: any;

    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    let onUpdatedIssues: any;

    const statsIntervalTick = async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve(true);
        await Promise.all([Promise.resolve(true)]);
    };

    const expectAggregatedMetrics = (metrics: any, callNumber?: number) => {
        const call = onUpdatedIssues.mock.calls[callNumber || 0];
        const arg = call[0];
        expect(arg).toMatchObject({ aggregated: { metrics } });
    };

    const expectAggregatedIssues = (issues: any, callNumber?: number) => {
        const call = onUpdatedIssues.mock.calls[callNumber || 0];
        const arg = call[0];
        expect(arg).toMatchObject({ aggregated: { issues } });
    };

    beforeEach(() => {
        onUpdatedIssues = jest.fn();

        localCam = createMockClient("localcam", true);
        remoteCam1 = createMockClient("remotecam1", false);
        remoteCam2 = createMockClient("remotecam2", false);

        setPeerConnectionsForTests([
            createMockPeerConnection([localCam]),
            createMockPeerConnection([remoteCam1, remoteCam2]),
        ]);

        setClientProvider(() => [localCam, remoteCam1, remoteCam2]);

        stopSubscription = subscribeIssues({ onUpdatedIssues }).stop;
    });

    afterEach(async () => {
        stopSubscription();
        await statsIntervalTick();
    });

    it("tracks rendered and active videos", async () => {
        await statsIntervalTick();

        expectAggregatedMetrics({
            "loc-cam-video-active": { totAvg: 1 },
            "rem-cam-video-active": { totAvg: 2 },
            "loc-cam-video-rendered": { totAvg: 1 },
            "rem-cam-video-rendered": { totAvg: 2 },
        });
    });

    it("tracks aggregated metrics", async () => {
        localCam.video.stats.bytesSent = (200000 / 8) * 2;
        remoteCam1.video.stats.bytesReceived = (300000 / 8) * 2;
        remoteCam2.video.stats.bytesReceived = (400000 / 8) * 2;

        await statsIntervalTick();

        expectAggregatedMetrics({
            "loc-cam-video-bitrate": { avg: 200000, totAvg: 200000, ticks: 1, totTicks: 1 },
            "rem-cam-video-bitrate": { avg: 350000, totAvg: 700000, ticks: 2, totTicks: 1 },
        });
    });

    it("tracks aggregated issues", async () => {
        localCam.video.stats.bytesSent = 0;
        remoteCam1.video.stats.bytesReceived = (300000 / 8) * 2;
        remoteCam2.video.stats.bytesReceived = 0;

        await statsIntervalTick();

        expectAggregatedIssues({
            "loc-cam-video-dry-track": { registered: 1, ticks: 1 },
            "rem-cam-video-dry-track": { registered: 1, ticks: 2 },
        });
    });

    it("tracks issues and metrics over time", async () => {
        localCam.video.stats.bytesSent = (200000 / 8) * 2;
        remoteCam1.video.stats.bytesReceived = (300000 / 8) * 2;
        remoteCam2.video.stats.bytesReceived = 0;

        await statsIntervalTick();

        expectAggregatedIssues({
            "loc-cam-video-dry-track": { active: false, registered: 0, ticks: 1 },
            "rem-cam-video-dry-track": { active: true, registered: 1, ticks: 2 },
        });

        expectAggregatedMetrics({
            "loc-cam-video-bitrate": { avg: 200000, ticks: 1 },
            "rem-cam-video-bitrate": { avg: 150000, totAvg: 300000, ticks: 2, totTicks: 1 },
        });

        expect(onUpdatedIssues).toHaveBeenCalledTimes(1);

        localCam.video.stats.bytesSent += 0;
        remoteCam1.video.stats.bytesReceived += (300000 / 8) * 2;
        remoteCam2.video.stats.bytesReceived += (400000 / 8) * 2;

        await statsIntervalTick();

        expect(onUpdatedIssues).toHaveBeenCalledTimes(2);

        expectAggregatedIssues(
            {
                "loc-cam-video-dry-track": { active: true, registered: 1, ticks: 2, initial: 0 },
                "rem-cam-video-dry-track": { active: false, registered: 1, ticks: 4, initial: 1 },
            },
            1
        );

        expectAggregatedMetrics(
            {
                "loc-cam-video-bitrate": { avg: 100000, ticks: 2 },
                "rem-cam-video-bitrate": {
                    avg: (150000 + 350000) / 2,
                    totAvg: (300000 + 700000) / 2,
                    curAvg: 350000,
                    ticks: 4,
                    totTicks: 2,
                    curTicks: 2,
                },
            },
            1
        );
    });
});
