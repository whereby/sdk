import { createStore } from "../store.setup";
import { doStartConnectionMonitor, doStopConnectionMonitor } from "../../slices/connectionMonitor";
import { setClientProvider, subscribeIssues } from "@whereby.com/media";

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
    });
});
