import type { PreCallTestError, PreCallTestResult, PreCallTestStatus } from "../../redux/slices/preCallTest";

/* Pre-call test events */
export const PRE_CALL_TEST_STATUS_CHANGED = "pre-call-test:status-changed";
export const PRE_CALL_TEST_RESULT_CHANGED = "pre-call-test:result-changed";
export const PRE_CALL_TEST_ERROR_CHANGED = "pre-call-test:error-changed";

export type PreCallTestEvents = {
    [PRE_CALL_TEST_STATUS_CHANGED]: [status: PreCallTestStatus];
    [PRE_CALL_TEST_RESULT_CHANGED]: [result: PreCallTestResult | null];
    [PRE_CALL_TEST_ERROR_CHANGED]: [error: PreCallTestError | null];
};
