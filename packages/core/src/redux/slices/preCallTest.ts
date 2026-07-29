import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { BandwidthTester } from "@whereby.com/media";
import { createAppAsyncThunk } from "../thunk";
import { RootState } from "../store";
import { startAppListening } from "../listenerMiddleware";
import { doAppStop } from "./app";
import { selectIsHDModeEnabled, selectIsLowDataModeEnabled } from "./localMedia";

export const MIN_PRE_CALL_TEST_DURATION_S = 10;
export const DEFAULT_PRE_CALL_TEST_DURATION_S = 15;

export type PreCallTestStatus = "idle" | "running" | "completed" | "failed";

export type PreCallTestErrorReason = "timeout" | "unsupported" | "invalid-duration" | "unknown";

export interface PreCallTestError {
    reason: PreCallTestErrorReason;
    message: string;
}

export interface PreCallTestDetails {
    testTime: number;
    recvAvailableBitrate: number;
    lowRecvAvailableBitrate: boolean;
    sendLoss: number;
    recvLoss: number;
    highSendLoss: boolean;
    highRecvLoss: boolean;
}

export interface PreCallTestResult {
    success: boolean;
    warning: boolean;
    details: PreCallTestDetails;
}

export interface PreCallTestOptions {
    durationSeconds?: number;
    sfuServerOverrideHost?: string;
}

export interface PreCallTestState {
    status: PreCallTestStatus;
    result: PreCallTestResult | null;
    error: PreCallTestError | null;
    raw: {
        tester?: BandwidthTester;
    };
}

const initialState: PreCallTestState = {
    status: "idle",
    result: null,
    error: null,
    raw: {},
};

export const preCallTestSlice = createSlice({
    name: "preCallTest",
    initialState,
    reducers: {
        preCallTestStarted(state, action: PayloadAction<{ tester: BandwidthTester }>) {
            state.status = "running";
            state.result = null;
            state.error = null;
            // Immer leaves class instances alone at runtime; the cast is only to
            // stop it expanding BandwidthTester into a WritableDraft.
            state.raw = { tester: action.payload.tester } as typeof state.raw;
        },
        preCallTestCompleted(state, action: PayloadAction<{ result: PreCallTestResult }>) {
            state.status = "completed";
            state.result = action.payload.result;
            state.error = null;
            state.raw = {};
        },
        preCallTestFailed(state, action: PayloadAction<{ error: PreCallTestError }>) {
            state.status = "failed";
            state.result = null;
            state.error = action.payload.error;
            state.raw = {};
        },
        preCallTestStopped(state) {
            state.status = "idle";
            state.result = null;
            state.error = null;
            state.raw = {};
        },
    },
});

export const { preCallTestStarted, preCallTestCompleted, preCallTestFailed, preCallTestStopped } =
    preCallTestSlice.actions;

/**
 * Selectors
 */

export const selectPreCallTestRaw = (state: RootState) => state.preCallTest.raw;
export const selectPreCallTestStatus = (state: RootState) => state.preCallTest.status;
export const selectPreCallTestResult = (state: RootState) => state.preCallTest.result;
export const selectPreCallTestError = (state: RootState) => state.preCallTest.error;
export const selectIsPreCallTestRunning = (state: RootState) => state.preCallTest.status === "running";

/**
 * Thunks
 */

export const doStartPreCallTest = createAppAsyncThunk<PreCallTestResult | null, PreCallTestOptions | undefined>(
    "preCallTest/start",
    async (options, { dispatch, getState }) => {
        const state = getState();

        if (selectIsPreCallTestRunning(state)) {
            return null;
        }

        const durationSeconds = options?.durationSeconds ?? DEFAULT_PRE_CALL_TEST_DURATION_S;

        if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_PRE_CALL_TEST_DURATION_S) {
            dispatch(
                preCallTestFailed({
                    error: {
                        reason: "invalid-duration",
                        message: `durationSeconds must be at least ${MIN_PRE_CALL_TEST_DURATION_S}, got ${durationSeconds}`,
                    },
                }),
            );
            return null;
        }

        if (typeof document === "undefined") {
            dispatch(
                preCallTestFailed({
                    error: {
                        reason: "unsupported",
                        message: "The pre-call test needs a browser environment and is not available here",
                    },
                }),
            );
            return null;
        }

        let tester: BandwidthTester;

        try {
            tester = new BandwidthTester({
                features: {
                    sfuServerOverrideHost: options?.sfuServerOverrideHost,
                    sfuVp9On: false,
                    h264On: false,
                    simulcastScreenshareOn: false,
                    lowDataModeEnabled: selectIsLowDataModeEnabled(state) || !selectIsHDModeEnabled(state),
                },
            });
        } catch (error) {
            dispatch(
                preCallTestFailed({
                    error: {
                        reason: "unknown",
                        message: error instanceof Error ? error.message : "Failed to set up the pre-call test",
                    },
                }),
            );
            return null;
        }

        dispatch(preCallTestStarted({ tester }));

        return await new Promise<PreCallTestResult | null>((resolve) => {
            let settled = false;

            const settle = (value: PreCallTestResult | null) => {
                if (settled) {
                    return;
                }
                settled = true;
                tester.removeListener("result", onResult);
                tester.removeListener("close", onClose);
                resolve(value);
            };

            const wasStopped = () => selectPreCallTestStatus(getState()) !== "running";

            const onResult = (result: {
                error?: boolean;
                success?: boolean;
                warning?: boolean;
                details?: Partial<PreCallTestDetails> & { timeout?: boolean };
            }) => {
                if (wasStopped()) {
                    settle(null);
                    return;
                }

                if (result?.error) {
                    dispatch(
                        preCallTestFailed({
                            error: {
                                reason: result.details?.timeout ? "timeout" : "unknown",
                                message: result.details?.timeout
                                    ? "Timed out connecting to the Whereby media servers"
                                    : "The connection to the Whereby media servers failed",
                            },
                        }),
                    );
                    settle(null);
                    return;
                }

                const preCallTestResult: PreCallTestResult = {
                    success: !!result.success,
                    warning: !!result.warning,
                    details: {
                        testTime: result.details?.testTime ?? 0,
                        recvAvailableBitrate: result.details?.recvAvailableBitrate ?? 0,
                        lowRecvAvailableBitrate: !!result.details?.lowRecvAvailableBitrate,
                        sendLoss: result.details?.sendLoss ?? 0,
                        recvLoss: result.details?.recvLoss ?? 0,
                        highSendLoss: !!result.details?.highSendLoss,
                        highRecvLoss: !!result.details?.highRecvLoss,
                    },
                };

                dispatch(preCallTestCompleted({ result: preCallTestResult }));
                settle(preCallTestResult);
            };

            const onClose = () => {
                if (wasStopped()) {
                    settle(null);
                    return;
                }

                dispatch(
                    preCallTestFailed({
                        error: {
                            reason: "unknown",
                            message: "The pre-call test ended before reporting a result",
                        },
                    }),
                );
                settle(null);
            };

            tester.on("result", onResult);
            tester.on("close", onClose);

            try {
                tester.start(durationSeconds);
            } catch (error) {
                dispatch(
                    preCallTestFailed({
                        error: {
                            reason: "unknown",
                            message: error instanceof Error ? error.message : "Failed to start the pre-call test",
                        },
                    }),
                );
                settle(null);
            }
        });
    },
);

export const doStopPreCallTest = createAppAsyncThunk("preCallTest/stop", async (_, { dispatch, getState }) => {
    const { tester } = selectPreCallTestRaw(getState());

    dispatch(preCallTestStopped());
    tester?.close();
});

startAppListening({
    actionCreator: doAppStop,
    effect: (_, { dispatch, getState }) => {
        if (selectPreCallTestRaw(getState()).tester) {
            dispatch(doStopPreCallTest());
        }
    },
});
