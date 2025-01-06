import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";

/**
 * Reducer
 */
export interface BreakoutState {
    startedAt?: number;
    initiatedBy?: {
        clientId?: string;
        userId?: string;
        deviceId?: string;
        active?: boolean;
    };
}

const initialState: BreakoutState = {};

export const breakoutSlice = createSlice({
    name: "breakout",
    initialState,
    reducers: {},
});

/**
 * Selectors
 */
export const selectBreakoutRaw = (state: RootState) => state.breakout;
export const selectBreakoutInitiatedBy = (state: RootState) => state.breakout.initiatedBy;
