import { createSelector } from "@reduxjs/toolkit";
import { selectPreCallTestError, selectPreCallTestResult, selectPreCallTestStatus } from "../../redux";
import { PreCallTestState } from "./types";

export const selectPreCallTestState = createSelector(
    selectPreCallTestStatus,
    selectPreCallTestResult,
    selectPreCallTestError,
    (status, result, error) => {
        const state: PreCallTestState = {
            status,
            result,
            error,
        };
        return state;
    },
);
