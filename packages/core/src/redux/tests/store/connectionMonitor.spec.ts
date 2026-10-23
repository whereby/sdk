import { createStore, mockRtcManager } from "../store.setup";
import { randomLocalParticipant, randomRemoteParticipant } from "../../../__mocks__/appMocks";
import {
    RemoteCallQualityScores,
    ConnectionMonitorReport,
    ConnectionMonitorState,
    doSetRemoteCallQualityScores,
    doSetLocalCallQualityScore,
    doStartConnectionMonitor,
    doStopConnectionMonitor,
    doUpdateConnectionMonitorReport,
    selectRemoteParticipantQualityReport,
    selectRemoteCallQualityScores,
    selectConnectionMonitorIssuesReport,
    selectLocalCallQualityScore,
} from "../../slices/connectionMonitor";
import { rtcEvents } from "../../slices/rtcConnection/actions";
import { signalEvents } from "../../slices/signalConnection/actions";
import { roomSliceInitialState } from "../../slices/room";
import { setClientProvider, subscribeIssues } from "@whereby.com/media";

jest.mock("@whereby.com/media", () => {
    return {
        __esModule: true,
        ...jest.requireActual("@whereby.com/media"),
        setClientProvider: jest.fn(),
        subscribeIssues: jest.fn().mockImplementation(() => {
            return {
                stop: jest.fn(),
            };
        }),
    };
});

const LOCAL_ID = "local-1";
const REMOTE_ID = "remote-1";

function createConnectedStore(mode: "normal" | "group") {
    return createStore({
        initialState: {
            room: { ...roomSliceInitialState, mode },
            localParticipant: randomLocalParticipant({ id: LOCAL_ID }),
            remoteParticipants: {
                remoteParticipants: [randomRemoteParticipant({ id: REMOTE_ID })],
            },
        },
        withRtcManager: true,
        connectToRoom: true,
    });
}

// Not connected to a room, so the call quality scoring reactor leaves the state alone
function createMonitorStore({
    connectionMonitor,
    withRtcManager = true,
}: { connectionMonitor?: Partial<ConnectionMonitorState>; withRtcManager?: boolean } = {}) {
    return createStore({
        initialState: {
            localParticipant: randomLocalParticipant({ id: LOCAL_ID }),
            connectionMonitor: { running: true, ...connectionMonitor },
        },
        withRtcManager,
    });
}

const ok = { total: "ok", video: "ok", audio: "ok" } as const;
const warning = { total: "warning", video: "warning", audio: "ok" } as const;
const critical = { total: "critical", video: "critical", audio: "ok" } as const;

const activeIssue = { active: true, ticks: 3, registered: 3 };

describe("connectionMonitorSlice", () => {
    describe("actions", () => {
        it("doStartConnectionMonitor", () => {
            const store = createStore();

            store.dispatch(doStartConnectionMonitor());

            const after = store.getState().connectionMonitor;

            expect(setClientProvider).toHaveBeenCalledTimes(1);
            expect(subscribeIssues).toHaveBeenCalledTimes(1);

            expect(after.stopCallbackFunction).not.toHaveBeenCalled();
        });

        it("doStopConnectionMonitor", () => {
            const mockStopIssueSubscription = jest.fn();

            const store = createStore({
                initialState: {
                    connectionMonitor: {
                        running: true,
                        stopCallbackFunction: mockStopIssueSubscription,
                    },
                },
            });

            store.dispatch(doStopConnectionMonitor());

            expect(mockStopIssueSubscription).toHaveBeenCalledTimes(1);
        });

        describe("doSetRemoteCallQualityScores", () => {
            it("does nothing without an rtc manager", () => {
                const store = createMonitorStore({ withRtcManager: false });

                store.dispatch(doSetRemoteCallQualityScores({ [REMOTE_ID]: warning }));

                expect(selectRemoteCallQualityScores(store.getState())).toBeUndefined();
                expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalled();
            });

            it("stores the scores", () => {
                const store = createMonitorStore();
                const scores: RemoteCallQualityScores = { "remote-1": ok, "remote-2": warning };

                store.dispatch(doSetRemoteCallQualityScores(scores));

                expect(selectRemoteCallQualityScores(store.getState())).toEqual(scores);
            });

            it.each`
                description               | remoteScores                                     | expected
                ${"no remote clients"}    | ${{}}                                            | ${"ok"}
                ${"all ok"}               | ${{ "remote-1": ok, "remote-2": ok }}            | ${"ok"}
                ${"ok and warning"}       | ${{ "remote-1": ok, "remote-2": warning }}       | ${"warning"}
                ${"warning and critical"} | ${{ "remote-1": warning, "remote-2": critical }} | ${"critical"}
            `(
                "reports the worst remote total ($expected) to rtcstats for $description",
                ({ remoteScores, expected }) => {
                    const store = createMonitorStore();

                    store.dispatch(doSetRemoteCallQualityScores(remoteScores));

                    expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith("remoteCallQualityScores", {
                        total: expected,
                        _time: expect.any(Number),
                    });
                },
            );
        });

        describe("doSetLocalCallQualityScore", () => {
            it("does nothing without an rtc manager", () => {
                const store = createMonitorStore({ withRtcManager: false });

                store.dispatch(doSetLocalCallQualityScore(warning));

                expect(selectLocalCallQualityScore(store.getState())).toBeUndefined();
                expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalled();
            });

            it("stores the score and reports the first total to rtcstats", () => {
                const store = createMonitorStore();

                store.dispatch(doSetLocalCallQualityScore(ok));

                expect(selectLocalCallQualityScore(store.getState())).toEqual(ok);
                expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith("callQualityScoreTotalChanged", {
                    total: "ok",
                    _time: expect.any(Number),
                });
            });

            it("reports the total to rtcstats when it changes", () => {
                const store = createMonitorStore({ connectionMonitor: { localQualityScore: ok } });

                store.dispatch(doSetLocalCallQualityScore(warning));

                expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith("callQualityScoreTotalChanged", {
                    total: "warning",
                    _time: expect.any(Number),
                });
            });

            it("stores the score without reporting to rtcstats when the total is unchanged", () => {
                const store = createMonitorStore({ connectionMonitor: { localQualityScore: warning } });
                const score = { total: "warning", video: "ok", audio: "warning" } as const;

                store.dispatch(doSetLocalCallQualityScore(score));

                expect(selectLocalCallQualityScore(store.getState())).toEqual(score);
                expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalled();
            });
        });

        describe("doUpdateConnectionMonitorReport", () => {
            const emptyReport: ConnectionMonitorReport = { critical: {}, warning: {} };

            it("does nothing without an rtc manager", () => {
                const store = createMonitorStore({ withRtcManager: false });

                store.dispatch(
                    doUpdateConnectionMonitorReport({
                        critical: {},
                        warning: { [REMOTE_ID]: { video: ["rem-cam-video-bad-network"] } },
                    }),
                );

                expect(selectConnectionMonitorIssuesReport(store.getState())).toBeUndefined();
            });

            it("stores a new report", () => {
                const store = createMonitorStore();
                const report: ConnectionMonitorReport = {
                    critical: { [REMOTE_ID]: { video: ["rem-cam-video-extreme-packetloss"] } },
                    warning: {},
                };

                store.dispatch(doUpdateConnectionMonitorReport(report));

                expect(selectConnectionMonitorIssuesReport(store.getState())).toEqual(report);
            });

            it("keeps the existing report when the new one is identical", () => {
                const report: ConnectionMonitorReport = {
                    critical: {},
                    warning: { [REMOTE_ID]: { audio: ["rem-cam-audio-bad-network"] } },
                };
                const store = createMonitorStore({ connectionMonitor: { issuesReport: report } });

                store.dispatch(doUpdateConnectionMonitorReport(JSON.parse(JSON.stringify(report))));

                expect(selectConnectionMonitorIssuesReport(store.getState())).toBe(report);
                expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalled();
            });

            it.each`
                level         | kind       | clientId     | issue
                ${"warning"}  | ${"video"} | ${REMOTE_ID} | ${{ video: ["rem-cam-video-bad-network"] }}
                ${"warning"}  | ${"audio"} | ${REMOTE_ID} | ${{ audio: ["rem-cam-audio-bad-network"] }}
                ${"critical"} | ${"video"} | ${REMOTE_ID} | ${{ video: ["rem-cam-video-bad-network"] }}
                ${"warning"}  | ${"video"} | ${LOCAL_ID}  | ${{ video: ["loc-cam-video-bad-network"] }}
            `(
                "reports a $level $kind bad network issue for $clientId to rtcstats when it starts and ends",
                ({ level, clientId, issue }) => {
                    const store = createMonitorStore({ connectionMonitor: { issuesReport: emptyReport } });

                    store.dispatch(doUpdateConnectionMonitorReport({ ...emptyReport, [level]: { [clientId]: issue } }));

                    expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenLastCalledWith("clientStates", {
                        updatesByClientId: { [clientId]: { badNetwork: true } },
                        _time: expect.any(Number),
                    });

                    store.dispatch(doUpdateConnectionMonitorReport(emptyReport));

                    expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenLastCalledWith("clientStates", {
                        updatesByClientId: { [clientId]: { badNetwork: false } },
                        _time: expect.any(Number),
                    });
                },
            );

            it("does not report to rtcstats for issues other than a bad network", () => {
                const store = createMonitorStore({ connectionMonitor: { issuesReport: emptyReport } });

                store.dispatch(
                    doUpdateConnectionMonitorReport({
                        critical: { [REMOTE_ID]: { video: ["rem-cam-video-extreme-packetloss"] } },
                        warning: { [REMOTE_ID]: { audio: ["rem-cam-audio-high-packetloss"] } },
                    }),
                );

                expect(selectConnectionMonitorIssuesReport(store.getState())).not.toBe(emptyReport);
                expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalled();
            });

            it("does not report to rtcstats again while a bad network issue continues", () => {
                const report: ConnectionMonitorReport = {
                    critical: {},
                    warning: { [REMOTE_ID]: { video: ["rem-cam-video-bad-network"] } },
                };
                const store = createMonitorStore({ connectionMonitor: { issuesReport: report } });

                store.dispatch(
                    doUpdateConnectionMonitorReport({
                        critical: {},
                        warning: {
                            [REMOTE_ID]: { video: ["rem-cam-video-bad-network"], audio: ["rem-cam-audio-distorted"] },
                        },
                    }),
                );

                expect(mockRtcManager.sendStatsCustomEvent).not.toHaveBeenCalled();
            });
        });
    });

    describe("call quality scores", () => {
        describe("in a group room", () => {
            it("scores each remote client from SFU media quality, with total as the worst of video and audio", () => {
                const store = createConnectedStore("group");

                store.dispatch(
                    rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "video", quality: "warning" }),
                );
                store.dispatch(
                    rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "audio", quality: "critical" }),
                );

                expect(selectRemoteCallQualityScores(store.getState())).toEqual({
                    [REMOTE_ID]: { total: "critical", video: "warning", audio: "critical" },
                });
                expect(selectRemoteParticipantQualityReport(store.getState())).toEqual({
                    [REMOTE_ID]: { quality: "critical" },
                });
                expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                    "remoteCallQualityScores",
                    expect.objectContaining({ total: "critical" }),
                );
            });

            it("scores the local client separately and reports its total to rtcstats", () => {
                const store = createConnectedStore("group");

                store.dispatch(
                    rtcEvents.mediaQualityChanged({ clientId: LOCAL_ID, kind: "audio", quality: "critical" }),
                );

                expect(selectRemoteCallQualityScores(store.getState())).toEqual({ [REMOTE_ID]: ok });
                expect(selectLocalCallQualityScore(store.getState())).toEqual({
                    total: "critical",
                    video: "ok",
                    audio: "critical",
                });
                expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith("callQualityScoreTotalChanged", {
                    total: "critical",
                    _time: expect.any(Number),
                });
            });

            it("keeps the same scores reference when a scoring pass produces identical scores", () => {
                const store = createConnectedStore("group");

                store.dispatch(
                    rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "video", quality: "warning" }),
                );
                const scores = selectRemoteCallQualityScores(store.getState());

                // Changes mediaScores (so the reactor runs again) without changing the resulting scores
                store.dispatch(rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "audio", quality: "ok" }));

                expect(selectRemoteCallQualityScores(store.getState())).toBe(scores);
            });
        });

        describe("in a normal room", () => {
            it("scores each remote client from the issue monitor report", () => {
                const store = createConnectedStore("normal");
                store.dispatch(doStartConnectionMonitor());

                const { onUpdatedIssues } = (subscribeIssues as jest.Mock).mock.calls[0][0];
                onUpdatedIssues(
                    {
                        [LOCAL_ID]: { issues: {} },
                        [REMOTE_ID]: {
                            issues: {
                                "rem-cam-video-extreme-packetloss": activeIssue,
                                "rem-cam-audio-high-packetloss": activeIssue,
                            },
                        },
                        aggregated: { metrics: {} },
                    },
                    undefined,
                    [
                        { clientId: LOCAL_ID, isLocalClient: true },
                        { clientId: REMOTE_ID, isLocalClient: false },
                    ],
                );

                expect(selectRemoteCallQualityScores(store.getState())).toEqual({
                    [REMOTE_ID]: { total: "critical", video: "critical", audio: "warning" },
                });
            });
        });

        it("resets the scores after leaving the room", () => {
            const store = createConnectedStore("group");
            store.dispatch(doStartConnectionMonitor());

            store.dispatch(rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "video", quality: "warning" }));
            expect(selectRemoteCallQualityScores(store.getState())).toBeDefined();
            expect(selectLocalCallQualityScore(store.getState())).toBeDefined();

            store.dispatch(signalEvents.roomLeft());

            expect(selectRemoteCallQualityScores(store.getState())).toBeUndefined();
            expect(selectLocalCallQualityScore(store.getState())).toBeUndefined();
        });
    });
});
