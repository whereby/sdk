import { RoomMode } from "@whereby.com/media";
import { ClientView } from "../../types";
import {
    ConnectionMonitorReport,
    MediaQualityScores,
    selectCalculatedRemoteCallQualityScores,
    selectCalculatedLocalCallQualityScore,
    selectRemoteParticipantQualityReport,
    selectLocalParticipantQualityReport,
    selectShouldStartConnectionMonitor,
    selectShouldStopConnectionMonitor,
    connectionMonitorStarted,
    connectionMonitorStopped,
    connectionMonitorSlice,
    updateRemoteCallQualityScores,
    updateLocalCallQualityScore,
} from "../connectionMonitor";
import { ConnectionStatus } from "../roomConnection";
import { rtcEvents } from "../rtcConnection/actions";

describe("connectionMonitorSlice", () => {
    describe("reducers", () => {
        describe("connectionMonitorStarted", () => {
            it("should set running to true and set callback function", () => {
                const stopCallbackFunction = () => {};

                const result = connectionMonitorSlice.reducer(
                    undefined,
                    connectionMonitorStarted({ stopIssueSubscription: stopCallbackFunction }),
                );

                expect(result).toEqual({
                    running: true,
                    stopCallbackFunction,
                });
            });
        });
        describe("connectionMonitorStopped", () => {
            it("should set running to false and clear callback function", () => {
                const stopCallbackFunction = () => {};

                connectionMonitorSlice.reducer(
                    undefined,
                    connectionMonitorStarted({ stopIssueSubscription: stopCallbackFunction }),
                );

                const result = connectionMonitorSlice.reducer(undefined, connectionMonitorStopped());

                expect(result).toEqual({
                    running: false,
                    stopCallbackFunction: undefined,
                });
            });
        });
        describe("updateRemoteCallQualityScores", () => {
            it("should set the call quality scores", () => {
                const scores = {
                    "client-1": { total: "warning", video: "warning", audio: "ok" },
                } as const;

                const result = connectionMonitorSlice.reducer(undefined, updateRemoteCallQualityScores(scores));

                expect(result.remoteQualityScores).toEqual(scores);
            });
        });
        describe("updateLocalCallQualityScore", () => {
            it("should set the local call quality score", () => {
                const score = { total: "warning", video: "warning", audio: "ok" } as const;

                const result = connectionMonitorSlice.reducer(undefined, updateLocalCallQualityScore(score));

                expect(result.localQualityScore).toEqual(score);
            });
        });
        describe("mediaQualityChanged", () => {
            it("should merge media quality per client and per kind", () => {
                let result = connectionMonitorSlice.reducer(
                    undefined,
                    rtcEvents.mediaQualityChanged({ clientId: "client-1", kind: "video", quality: "warning" }),
                );
                result = connectionMonitorSlice.reducer(
                    result,
                    rtcEvents.mediaQualityChanged({ clientId: "client-1", kind: "audio", quality: "critical" }),
                );
                result = connectionMonitorSlice.reducer(
                    result,
                    rtcEvents.mediaQualityChanged({ clientId: "client-2", kind: "video", quality: "ok" }),
                );

                expect(result.mediaScores).toEqual({
                    "client-1": { video: "warning", audio: "critical" },
                    "client-2": { video: "ok" },
                });
            });
        });
    });
    describe("reactors", () => {
        describe("selectShouldStartConnectionMonitor", () => {
            it.each`
                roomConnectionStatus | isRunning | expected
                ${"ready"}           | ${false}  | ${false}
                ${"connecting"}      | ${false}  | ${false}
                ${"connected"}       | ${true}   | ${false}
                ${"connected"}       | ${false}  | ${true}
            `(
                "should return $expected when roomConnectionStatus=$roomConnectionStatus, isRunning=$isRunning",
                ({ roomConnectionStatus, isRunning, expected }) => {
                    expect(selectShouldStartConnectionMonitor.resultFunc(roomConnectionStatus, isRunning)).toEqual(
                        expected,
                    );
                },
            );
        });

        describe("selectShouldStopConnectionMonitor", () => {
            it.each`
                roomConnectionStatus | isRunning | expected
                ${"ready"}           | ${true}   | ${false}
                ${"connected"}       | ${true}   | ${false}
                ${"left"}            | ${true}   | ${true}
                ${"kicked"}          | ${true}   | ${true}
            `(
                "should return $expected when roomConnectionStatus=$roomConnectionStatus, isRunning=$isRunning",
                ({ roomConnectionStatus, isRunning, expected }) => {
                    expect(selectShouldStopConnectionMonitor.resultFunc(roomConnectionStatus, isRunning)).toEqual(
                        expected,
                    );
                },
            );
        });

        describe("selectRemoteParticipantQualityReport", () => {
            it("should return undefined when there are no scores", () => {
                expect(selectRemoteParticipantQualityReport.resultFunc(undefined)).toBeUndefined();
            });

            it("should report each client's total as its quality", () => {
                expect(
                    selectRemoteParticipantQualityReport.resultFunc({
                        "remote-1": { total: "ok", video: "ok", audio: "ok" },
                        "remote-2": { total: "critical", video: "critical", audio: "warning" },
                        "remote-3": { total: "warning", video: "warning", audio: "ok" },
                    }),
                ).toEqual({
                    "remote-1": { quality: "ok" },
                    "remote-2": { quality: "critical" },
                    "remote-3": { quality: "warning" },
                });
            });
        });

        describe("selectLocalParticipantQualityReport", () => {
            it("should return undefined when there is no score", () => {
                expect(selectLocalParticipantQualityReport.resultFunc(undefined)).toBeUndefined();
            });

            it("should report the total as the quality", () => {
                expect(
                    selectLocalParticipantQualityReport.resultFunc({ total: "warning", video: "warning", audio: "ok" }),
                ).toEqual({ quality: "warning" });
            });

            it("should pass the cpu level through", () => {
                expect(
                    selectLocalParticipantQualityReport.resultFunc({
                        total: "ok",
                        video: "ok",
                        audio: "ok",
                        cpu: "critical",
                    }),
                ).toEqual({ quality: "ok", cpu: "critical" });
            });
        });

        describe("selectCalculatedRemoteCallQualityScores", () => {
            const clientViews = [{ clientId: "client-1" }, { clientId: "client-2" }] as ClientView[];
            const ok = { total: "ok", video: "ok", audio: "ok" };

            const calculate = ({
                roomConnectionStatus = "connected",
                roomMode = "normal",
                mediaScores,
                issuesReport,
            }: {
                roomConnectionStatus?: ConnectionStatus;
                roomMode?: RoomMode | null;
                mediaScores?: MediaQualityScores;
                issuesReport?: ConnectionMonitorReport;
            }) =>
                selectCalculatedRemoteCallQualityScores.resultFunc(
                    roomConnectionStatus,
                    roomMode,
                    clientViews,
                    mediaScores,
                    issuesReport,
                );

            it.each(["ready", "connecting", "reconnecting", "left", "kicked"] as const)(
                "should return undefined when roomConnectionStatus=%s",
                (roomConnectionStatus) => {
                    expect(calculate({ roomConnectionStatus })).toBeUndefined();
                },
            );

            it("should leave out the local screenshare", () => {
                expect(
                    selectCalculatedRemoteCallQualityScores.resultFunc(
                        "connected",
                        "normal",
                        [...clientViews, { clientId: "local-1", isLocalClient: true }] as ClientView[],
                        undefined,
                        undefined,
                    ),
                ).toEqual({ "client-1": ok, "client-2": ok });
            });

            it("should score every client as ok when there are no issues", () => {
                expect(calculate({ roomMode: "normal" })).toEqual({ "client-1": ok, "client-2": ok });
                expect(calculate({ roomMode: "group" })).toEqual({ "client-1": ok, "client-2": ok });
            });

            describe("in a normal room", () => {
                it.each`
                    issuesReport                                                                                               | expected
                    ${{ critical: { "client-1": { video: ["x"] } }, warning: {} }}                                             | ${{ total: "critical", video: "critical", audio: "ok" }}
                    ${{ critical: { "client-1": { audio: ["x"] } }, warning: {} }}                                             | ${{ total: "critical", video: "ok", audio: "critical" }}
                    ${{ critical: {}, warning: { "client-1": { video: ["x"] } } }}                                             | ${{ total: "warning", video: "warning", audio: "ok" }}
                    ${{ critical: {}, warning: { "client-1": { audio: ["x"] } } }}                                             | ${{ total: "warning", video: "ok", audio: "warning" }}
                    ${{ critical: { "client-1": { video: ["x"] } }, warning: { "client-1": { video: ["y"], audio: ["z"] } } }} | ${{ total: "critical", video: "critical", audio: "warning" }}
                    ${{ critical: { "client-1": { video: [] } }, warning: { "client-1": { audio: [] } } }}                     | ${ok}
                `(
                    "should score client-1 video=$expected.video, audio=$expected.audio, total=$expected.total from the issues report",
                    ({ issuesReport, expected }) => {
                        expect(calculate({ roomMode: "normal", issuesReport })).toEqual({
                            "client-1": expected,
                            "client-2": ok,
                        });
                    },
                );

                it("should ignore media quality scores", () => {
                    expect(
                        calculate({ roomMode: "normal", mediaScores: { "client-1": { video: "critical" } } }),
                    ).toEqual({ "client-1": ok, "client-2": ok });
                });
            });

            describe("in a group room", () => {
                it.each`
                    mediaScores                                                | expected
                    ${{ "client-1": { video: "critical" } }}                   | ${{ total: "critical", video: "critical", audio: "ok" }}
                    ${{ "client-1": { audio: "warning" } }}                    | ${{ total: "warning", video: "ok", audio: "warning" }}
                    ${{ "client-1": { video: "warning", audio: "critical" } }} | ${{ total: "critical", video: "warning", audio: "critical" }}
                    ${{ "client-1": { video: "ok", audio: "ok" } }}            | ${ok}
                `(
                    "should score client-1 video=$expected.video, audio=$expected.audio, total=$expected.total from the media quality scores",
                    ({ mediaScores, expected }) => {
                        expect(calculate({ roomMode: "group", mediaScores })).toEqual({
                            "client-1": expected,
                            "client-2": ok,
                        });
                    },
                );

                it("should ignore the issues report", () => {
                    expect(
                        calculate({
                            roomMode: "group",
                            issuesReport: { critical: { "client-1": { video: ["x"] } }, warning: {} },
                        }),
                    ).toEqual({ "client-1": ok, "client-2": ok });
                });
            });
        });

        describe("selectCalculatedLocalCallQualityScore", () => {
            const localParticipantView = { clientId: "local-1", isLocalClient: true } as ClientView;

            it("should return undefined when not connected", () => {
                expect(
                    selectCalculatedLocalCallQualityScore.resultFunc(
                        "connecting",
                        "normal",
                        localParticipantView,
                        undefined,
                        undefined,
                    ),
                ).toBeUndefined();
            });

            it("should return undefined without a local participant view", () => {
                expect(
                    selectCalculatedLocalCallQualityScore.resultFunc("connected", "normal", null, undefined, undefined),
                ).toBeUndefined();
            });

            it("should score the local client from the issues report in a normal room", () => {
                expect(
                    selectCalculatedLocalCallQualityScore.resultFunc(
                        "connected",
                        "normal",
                        localParticipantView,
                        undefined,
                        { critical: {}, warning: { "local-1": { audio: ["x"] } } },
                    ),
                ).toEqual({ total: "warning", video: "ok", audio: "warning" });
            });

            it("should score the local client from the media quality scores in a group room", () => {
                expect(
                    selectCalculatedLocalCallQualityScore.resultFunc(
                        "connected",
                        "group",
                        localParticipantView,
                        { "local-1": { video: "critical" } },
                        undefined,
                    ),
                ).toEqual({ total: "critical", video: "critical", audio: "ok" });
            });

            it("should leave out the cpu level when CPU pressure can't be measured", () => {
                expect(
                    selectCalculatedLocalCallQualityScore.resultFunc(
                        "connected",
                        "normal",
                        localParticipantView,
                        undefined,
                        { critical: { "local-1": { cpu: ["global-cpu-pressure-critical"] } }, warning: {} },
                    ),
                ).not.toHaveProperty("cpu");
            });

            describe("when CPU pressure can be measured", () => {
                beforeEach(() => {
                    Object.defineProperty(window, "PressureObserver", { value: jest.fn(), configurable: true });
                });

                afterEach(() => {
                    delete (window as { PressureObserver?: unknown }).PressureObserver;
                });

                const calculateCpu = (roomMode: RoomMode, issuesReport?: ConnectionMonitorReport) =>
                    selectCalculatedLocalCallQualityScore.resultFunc(
                        "connected",
                        roomMode,
                        localParticipantView,
                        undefined,
                        issuesReport,
                    )?.cpu;

                it.each<RoomMode>(["normal", "group"])("should score the cpu level in a %s room", (roomMode) => {
                    expect(calculateCpu(roomMode, undefined)).toBe("ok");
                    expect(
                        calculateCpu(roomMode, {
                            critical: {},
                            warning: { "local-1": { cpu: ["global-cpu-pressure-serious"] } },
                        }),
                    ).toBe("warning");
                    expect(
                        calculateCpu(roomMode, {
                            critical: { "local-1": { cpu: ["global-cpu-pressure-critical"] } },
                            warning: { "local-1": { cpu: ["global-cpu-pressure-serious"] } },
                        }),
                    ).toBe("critical");
                });

                it("should not include the cpu level in the total", () => {
                    expect(
                        selectCalculatedLocalCallQualityScore.resultFunc(
                            "connected",
                            "normal",
                            localParticipantView,
                            undefined,
                            { critical: { "local-1": { cpu: ["global-cpu-pressure-critical"] } }, warning: {} },
                        ),
                    ).toEqual({ total: "ok", video: "ok", audio: "ok", cpu: "critical" });
                });
            });
        });
    });
});
