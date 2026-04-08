import { createStore } from "../store.setup";
import { doStartConnectionMonitor, doStopConnectionMonitor } from "../../slices/connectionMonitor";
import { setClientProvider, subscribeIssues } from "@whereby.com/media";

jest.mock("@whereby.com/media", () => {
    return {
        __esModule: true,
        setClientProvider: jest.fn(),
        subscribeIssues: jest.fn().mockImplementation(async () => {
            return {
                stop: jest.fn(),
            };
        }),
    };
});

describe("connectionMonitorSlice", () => {
    describe("actions", () => {
        it("doStartConnectionMonitor", async () => {
            const store = createStore();

            await store.dispatch(doStartConnectionMonitor());

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
