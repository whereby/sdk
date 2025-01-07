import { createSlice } from "@reduxjs/toolkit";
import { BreakoutConfig } from "@whereby.com/media";
import { RootState } from "../store";
import { signalEvents } from "./signalConnection";

function createBreakout({
    assignments,
    groups,
    startedAt,
    initiatedBy,
    breakoutStartedAt,
    breakoutEndedAt,
    breakoutNotification,
    breakoutTimerDuration,
    autoMoveToGroup,
    moveToGroupGracePeriod,
    autoMoveToMain,
    moveToMainGracePeriod,
    enforceAssignment,
    breakoutTimerSetting,
}: BreakoutConfig = {}) {
    return {
        assignments: assignments || null,
        groups: groups || null,
        startedAt: startedAt ? new Date(startedAt) : null,
        initiatedBy,
        breakoutStartedAt: breakoutStartedAt || null,
        breakoutEndedAt: breakoutEndedAt || null,
        breakoutNotification: breakoutNotification || null,
        breakoutTimerDuration: breakoutTimerDuration || 1800,
        autoMoveToGroup: autoMoveToGroup || false,
        moveToGroupGracePeriod: moveToGroupGracePeriod || 10,
        autoMoveToMain: autoMoveToMain || false,
        moveToMainGracePeriod: moveToMainGracePeriod || 30,
        enforceAssignment: enforceAssignment || false,
        breakoutTimerSetting: breakoutTimerSetting || false,
    };
}

/**
 * Reducer
 */
export interface BreakoutState extends BreakoutConfig {}

const initialState: BreakoutState = {
    ...createBreakout(),
};

export const breakoutSlice = createSlice({
    name: "breakout",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if (action.payload.breakout) {
                return {
                    ...state,
                    ...createBreakout(action.payload.breakout),
                };
            }
            return state;
        });
        builder.addCase(signalEvents.breakoutSessionUpdated, (state, action) => {
            return {
                ...state,
                ...createBreakout(action.payload),
            };
        });
    },
});

/**
 * Selectors
 */
export const selectBreakoutRaw = (state: RootState) => state.breakout;
export const selectBreakoutInitiatedBy = (state: RootState) => state.breakout.initiatedBy;
