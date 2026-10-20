import { RoomMode } from "@whereby.com/media";
import { ClientView } from "../../types";
import {
    ConnectionMonitorReport,
    MediaQualityScores,
    selectCalculatedCallQualityScores,
    selectShouldStartConnectionMonitor,
    selectShouldStopConnectionMonitor,
    connectionMonitorStarted,
    connectionMonitorStopped,
    connectionMonitorSlice,
    updateCallQualityScores,
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
        describe("updateCallQualityScores", () => {
            it("should set the call quality scores", () => {
                const scores = {
                    "client-1": { total: "warning", video: "warning", audio: "ok" },
                } as const;

                const result = connectionMonitorSlice.reducer(undefined, updateCallQualityScores(scores));

                expect(result.qualityScores).toEqual(scores);
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

        describe("selectCalculatedCallQualityScores", () => {
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
                selectCalculatedCallQualityScores.resultFunc(
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
    });
});
