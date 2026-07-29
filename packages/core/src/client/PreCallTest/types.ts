import type { PreCallTestError, PreCallTestResult, PreCallTestStatus } from "../../redux/slices/preCallTest";

export interface PreCallTestState {
    /** `idle` before the first run, then `running`, `completed` or `failed`. */
    status: PreCallTestStatus;
    /** Set once a test completes. Cleared when a new test starts. */
    result: PreCallTestResult | null;
    /** Set when a test could not produce a result. Cleared when a new test starts. */
    error: PreCallTestError | null;
}

export type {
    PreCallTestDetails,
    PreCallTestError,
    PreCallTestErrorReason,
    PreCallTestOptions,
    PreCallTestResult,
    PreCallTestStatus,
} from "../../redux/slices/preCallTest";
