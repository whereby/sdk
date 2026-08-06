import { BandwidthTester } from "@whereby.com/media";
import {
    doStartPreCallTest,
    doStopPreCallTest,
    isPreCallTestSupported,
    selectPreCallTestError,
    selectPreCallTestResult,
    selectPreCallTestStatus,
} from "../../slices/preCallTest";
import { createStore } from "../store.setup";

jest.mock("@whereby.com/media", () => {
    const { EventEmitter } = jest.requireActual("events");

    return {
        __esModule: true,
        getStream: jest.fn(() => Promise.resolve()),
        getUpdatedDevices: jest.fn(() => Promise.resolve({ addedDevices: {}, changedDevices: {} })),
        getDeviceData: jest.fn(() => ({})),
        BandwidthTester: jest.fn().mockImplementation(() => {
            const tester = new EventEmitter();
            tester.start = jest.fn();
            tester.close = jest.fn(() => tester.emit("close"));
            return tester;
        }),
    };
});

const mockedBandwidthTester = BandwidthTester as unknown as jest.Mock;

const stubBrowserCapabilities = () => {
    HTMLCanvasElement.prototype.captureStream = jest.fn();
    Object.defineProperty(window, "RTCPeerConnection", { writable: true, configurable: true, value: jest.fn() });
};

const removeBrowserCapability = (capability: "captureStream" | "RTCPeerConnection") => {
    if (capability === "captureStream") {
        delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).captureStream;
    } else {
        Object.defineProperty(window, "RTCPeerConnection", {
            writable: true,
            configurable: true,
            value: undefined,
        });
    }
};

beforeEach(() => {
    stubBrowserCapabilities();
});

// Flush queued microtasks so the thunk reaches its event listeners.
const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
};

const startTest = async (store: ReturnType<typeof createStore>, options?: { durationSeconds?: number }) => {
    const dispatched = store.dispatch(doStartPreCallTest(options));
    await flushMicrotasks();

    return {
        dispatched,
        tester: mockedBandwidthTester.mock.results.at(-1)?.value,
    };
};

const successResult = {
    success: true,
    warning: false,
    details: {
        testTime: 15000,
        recvAvailableBitrate: 5,
        lowRecvAvailableBitrate: false,
        sendLoss: 0,
        recvLoss: 0,
        highSendLoss: false,
        highRecvLoss: false,
    },
};

describe("preCallTest", () => {
    describe("doStartPreCallTest", () => {
        it("runs for 15 seconds by default", async () => {
            const store = createStore();

            const { tester } = await startTest(store);

            expect(tester.start).toHaveBeenCalledWith(15);
            expect(selectPreCallTestStatus(store.getState())).toEqual("running");
        });

        it("rejects a duration shorter than the tester can report on", async () => {
            const store = createStore();

            const { dispatched } = await startTest(store, { durationSeconds: 5 });

            expect(await dispatched.unwrap()).toEqual(null);
            expect(mockedBandwidthTester).not.toHaveBeenCalled();
            expect(selectPreCallTestStatus(store.getState())).toEqual("failed");
            expect(selectPreCallTestError(store.getState())).toEqual({
                reason: "invalid-duration",
                message: "durationSeconds must be at least 10, got 5",
            });
        });

        it("reports the result of a completed test", async () => {
            const store = createStore();

            const { dispatched, tester } = await startTest(store);
            tester.emit("result", successResult);

            expect(await dispatched.unwrap()).toEqual(successResult);
            expect(selectPreCallTestStatus(store.getState())).toEqual("completed");
            expect(selectPreCallTestResult(store.getState())).toEqual(successResult);
            expect(selectPreCallTestError(store.getState())).toEqual(null);
        });

        it("fills in details the tester left out", async () => {
            const store = createStore();

            const { dispatched, tester } = await startTest(store);
            tester.emit("result", { warning: true, details: { recvAvailableBitrate: 0.5 } });

            expect(await dispatched.unwrap()).toEqual({
                success: false,
                warning: true,
                details: {
                    testTime: 0,
                    recvAvailableBitrate: 0.5,
                    lowRecvAvailableBitrate: false,
                    sendLoss: 0,
                    recvLoss: 0,
                    highSendLoss: false,
                    highRecvLoss: false,
                },
            });
        });

        it("reports a timeout as a failure", async () => {
            const store = createStore();

            const { dispatched, tester } = await startTest(store);
            tester.emit("result", { error: true, details: { timeout: true } });

            expect(await dispatched.unwrap()).toEqual(null);
            expect(selectPreCallTestStatus(store.getState())).toEqual("failed");
            expect(selectPreCallTestError(store.getState())).toEqual({
                reason: "timeout",
                message: "Timed out connecting to the Whereby media servers",
            });
            expect(selectPreCallTestResult(store.getState())).toEqual(null);
        });

        it("fails when the tester closes without reporting", async () => {
            const store = createStore();

            const { dispatched, tester } = await startTest(store);
            tester.emit("close");

            expect(await dispatched.unwrap()).toEqual(null);
            expect(selectPreCallTestStatus(store.getState())).toEqual("failed");
            expect(selectPreCallTestError(store.getState())?.reason).toEqual("unknown");
        });

        it("keeps the first result when the tester reports twice", async () => {
            const store = createStore();

            const { tester } = await startTest(store);
            tester.emit("result", successResult);
            tester.emit("result", { error: true });
            tester.emit("close");

            expect(selectPreCallTestStatus(store.getState())).toEqual("completed");
            expect(selectPreCallTestResult(store.getState())).toEqual(successResult);
        });

        it("leaves a running test alone", async () => {
            const store = createStore();

            const { tester } = await startTest(store);
            const { dispatched: second } = await startTest(store);

            expect(await second.unwrap()).toEqual(null);
            expect(mockedBandwidthTester).toHaveBeenCalledTimes(1);
            expect(tester.close).not.toHaveBeenCalled();
            expect(selectPreCallTestStatus(store.getState())).toEqual("running");
        });
    });

    describe("unsupported environments", () => {
        it.each(["captureStream", "RTCPeerConnection"] as const)("refuses to run without %s", async (capability) => {
            removeBrowserCapability(capability);
            const store = createStore();

            const { dispatched } = await startTest(store);

            expect(await dispatched.unwrap()).toEqual(null);
            expect(mockedBandwidthTester).not.toHaveBeenCalled();
            expect(selectPreCallTestStatus(store.getState())).toEqual("failed");

            const error = selectPreCallTestError(store.getState());
            expect(error?.reason).toEqual("unsupported");
            expect(error?.message).toContain(capability);
        });

        it("reports support up front so consumers can hide the UI", () => {
            expect(isPreCallTestSupported()).toEqual(true);

            removeBrowserCapability("captureStream");

            expect(isPreCallTestSupported()).toEqual(false);
        });
    });

    describe("doStopPreCallTest", () => {
        it("closes the tester and goes back to idle", async () => {
            const store = createStore();

            const { dispatched, tester } = await startTest(store);
            store.dispatch(doStopPreCallTest());

            expect(await dispatched.unwrap()).toEqual(null);
            expect(tester.close).toHaveBeenCalled();
            expect(selectPreCallTestStatus(store.getState())).toEqual("idle");
            expect(selectPreCallTestError(store.getState())).toEqual(null);
        });

        it("does not turn an aborted test into a failure", async () => {
            const store = createStore();

            const { tester } = await startTest(store);
            store.dispatch(doStopPreCallTest());
            // The tester emits on its way down, well after we stopped caring.
            tester.emit("result", { error: true, details: { timeout: true } });

            expect(selectPreCallTestStatus(store.getState())).toEqual("idle");
            expect(selectPreCallTestError(store.getState())).toEqual(null);
        });
    });
});
