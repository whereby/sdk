import {
    selectShouldStartConnectionMonitor,
    selectShouldStopConnectionMonitor,
    connectionMonitorStarted,
    connectionMonitorStopped,
    connectionMonitorSlice,
    updateCallQualityScores,
} from "../connectionMonitor";
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
    });
});
