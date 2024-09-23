import {
    selectShouldStartConnectionMonitor,
    selectShouldStopConnectionMonitor,
    connectionMonitorStarted,
    connectionMonitorStopped,
    connectionMonitorSlice,
} from "../connectionMonitor";

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
