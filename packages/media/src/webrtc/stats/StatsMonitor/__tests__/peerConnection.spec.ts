import {
    createMockedMediaStreamTrack,
    createRTCPeerConnectionStub,
    createRTCTrancieverStub,
} from "../../../../../tests/webrtc/webRtcHelpers";
import { getPeerConnectionsWithStatsReports } from "../peerConnection";
import { setPeerConnectionsForTests } from "../peerConnectionTracker";

describe("peerConnection", () => {
    describe("getPeerConnectionsWithStatsReports", () => {
        it("should return correct amount of peer connections", async () => {
            const pcStats = [new Map(), new Map(), new Map()];
            const existingPeerConnections = [
                createRTCPeerConnectionStub({ stats: pcStats[0] })(),
                createRTCPeerConnectionStub({ stats: pcStats[1] })(),
                createRTCPeerConnectionStub({ stats: pcStats[2] })(),
            ];
            setPeerConnectionsForTests(existingPeerConnections);

            const result = await getPeerConnectionsWithStatsReports();

            result.forEach(([pc, report], index) => {
                expect(pc).toEqual(existingPeerConnections[index]);
                expect(report).toEqual(pcStats[index]);
            });
        });

        it("should return empty reports if getStats fails", async () => {
            const peerConnection = createRTCPeerConnectionStub()();
            (peerConnection.getStats as jest.Mock).mockRejectedValue(new Error("Boom"));
            const existingPeerConnections = [peerConnection];
            setPeerConnectionsForTests(existingPeerConnections);

            const result = await getPeerConnectionsWithStatsReports();

            existingPeerConnections.forEach((_, index) => {
                expect(result[index][1]).toEqual([]);
            });
        });
        describe("ssrc to track mapping", () => {
            it.each([
                {
                    _scenario: "Creates empty mapping if stats are missing",
                    pcStats: [],
                    pcData: undefined,
                    expectedPcData: { ssrcToTrackId: {} },
                },
                {
                    _scenario: "Creates fake track id if no track can be found",
                    pcStats: [{ id: "inbound", type: "inbound-rtp", ssrc: 12 }],
                    pcData: undefined,
                    expectedPcData: { ssrcToTrackId: { "12": "?12" } },
                },
                {
                    _scenario: "Uses media source track identifier for outbound stats",
                    pcStats: [
                        { id: "outbound", type: "outbound-rtp", ssrc: 12, mediaSourceId: "mediaSource" },
                        { id: "mediaSource", type: "media-source", trackIdentifier: "track" },
                    ],
                    pcData: undefined,
                    expectedPcData: { ssrcToTrackId: { "12": "track" } },
                },
                {
                    _scenario: "Uses existing mapping",
                    pcStats: [
                        { id: "outbound", type: "outbound-rtp", ssrc: 12, mediaSourceId: "mediaSource" },
                        { id: "mediaSource", type: "media-source", trackIdentifier: "track" },
                    ],
                    pcData: { ssrcToTrackId: { 12: "existingTrack" } },
                    expectedPcData: { ssrcToTrackId: { "12": "existingTrack" } },
                },
                {
                    _scenario: "Uses deprecated trackId as fallback",
                    pcStats: [
                        { id: "inbound", type: "inbound-rtp", ssrc: 12, trackId: "trackId" },
                        {
                            id: "trackId",
                            type: "deprecated-track-attachment-stats",
                            trackIdentifier: "trackIdentifier",
                        },
                    ],
                    pcData: undefined,
                    expectedPcData: { ssrcToTrackId: { "12": "trackIdentifier" } },
                },
                {
                    _scenario: "Uses tranceivers as fallback",
                    pcStats: [{ id: "inbound", type: "inbound-rtp", ssrc: 12 }],
                    pcData: undefined,
                    receivers: [
                        {
                            track: { id: "receiverTrack", kind: "audio" },
                            stats: [{ id: "inbound", type: "inbound-rtp", ssrc: 12 }],
                        },
                    ],
                    senders: [
                        {
                            track: { id: "senderTrack", kind: "audio" },
                            stats: [{ id: "outbound", type: "outbound-rtp", ssrc: 13 }],
                        },
                    ],
                    expectedPcData: { ssrcToTrackId: { "12": "receiverTrack", 13: "senderTrack" } },
                },
                {
                    _scenario: "Dont map when trackIdentifier is present on inbound",
                    pcStats: [{ id: "inbound", type: "inbound-rtp", ssrc: 12, trackIdentifier: "notUsed" }],
                    pcData: undefined,
                    receivers: [
                        {
                            track: { id: "receiverTrack", kind: "audio" },
                            stats: [{ id: "inbound", type: "inbound-rtp", ssrc: 12 }],
                        },
                    ],
                    senders: [
                        {
                            track: { id: "senderTrack", kind: "audio" },
                            stats: [{ id: "outbound", type: "outbound-rtp", ssrc: 13 }],
                        },
                    ],
                    expectedPcData: { ssrcToTrackId: {} },
                },
            ])("$_scenario", async ({ pcStats, pcData, senders = [], receivers = [], expectedPcData }) => {
                const pc = createRTCPeerConnectionStub({
                    stats: new Map(pcStats.map((s) => [s.id, s])),
                    senders: senders.map(({ stats, track }) => {
                        return createRTCTrancieverStub<RTCRtpSender>({
                            stats: new Map(stats.map((s) => [s.id, s])),
                            track: createMockedMediaStreamTrack({ kind: track.kind, id: track.id }),
                        })();
                    }),
                    receivers: receivers.map(({ stats, track }) =>
                        createRTCTrancieverStub<RTCRtpReceiver>({
                            stats: new Map(stats.map((s) => [s.id, s])),
                            track: createMockedMediaStreamTrack({ kind: track.kind, id: track.id }),
                        })(),
                    ),
                })() as unknown as RTCPeerConnection;

                const pcDataByPc = new Map([[pc, pcData]]);
                setPeerConnectionsForTests([pc]);

                const [[_resultPc, _resultReport, resultPcData]] = await getPeerConnectionsWithStatsReports(pcDataByPc);

                expect(resultPcData).toEqual(expectedPcData);
            });
        });
    });
});
