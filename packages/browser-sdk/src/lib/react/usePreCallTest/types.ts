import { PreCallTestOptions, PreCallTestResult, PreCallTestState } from "@whereby.com/core";

interface PreCallTestActions {
    /**
     * Runs a test and resolves with its result, or with `null` if it could not
     * complete - `state.error` says why. A call made while a test is running
     * resolves with `null` and leaves the running test alone.
     */
    startTest: (options?: PreCallTestOptions) => Promise<PreCallTestResult | null>;
    /** Aborts a running test and returns to the idle state. */
    stopTest: () => void;
}

export type UsePreCallTestResult = { state: PreCallTestState; actions: PreCallTestActions };

export type UsePreCallTestOptions = PreCallTestOptions;
