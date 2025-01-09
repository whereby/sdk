import { createSelector, createSlice } from "@reduxjs/toolkit";
import { BreakoutConfig } from "@whereby.com/media";
import { RootState } from "../store";
import { selectSignalConnectionRaw, signalEvents } from "./signalConnection";
import { selectLocalParticipantBreakoutGroup, selectLocalParticipantRaw } from "./localParticipant/selectors";
import { startAppListening } from "../listenerMiddleware";
import { createAppThunk } from "../thunk";

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
export interface BreakoutState extends BreakoutConfig {
    groupId: string | null;
}

const initialState: BreakoutState = {
    ...createBreakout(),
    groupId: null,
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
        builder.addCase(signalEvents.breakoutGroupJoined, (state, action) => {
            // @ts-ignore
            console.log("action.meta", action.meta);
            console.log("action.payload", action.payload);
            // @ts-ignore
            if (action.meta?.participantId !== action.payload.clientId) {
                return state;
            }
            return {
                ...state,
                groupId: action.payload.group,
            };
        });
    },
});

export const doBreakoutJoin = createAppThunk((payload: { group: string }) => (_, getState) => {
    const state = getState();

    const { socket } = selectSignalConnectionRaw(state);
    socket?.emit("join_breakout_group", { group: payload.group });
});

/**
 * Selectors
 */
export const selectBreakoutRaw = (state: RootState) => state.breakout;
export const selectBreakoutInitiatedBy = (state: RootState) => state.breakout.initiatedBy;
export const selectBreakoutActive = (state: RootState) => !!state.breakout.startedAt;
export const selectBreakoutAssignments = (state: RootState) => state.breakout.assignments || {};

export const selectBreakoutCurrentId = createSelector(
    selectBreakoutRaw,
    selectLocalParticipantBreakoutGroup,
    (raw, localParticipantBreakoutGroup) => {
        return raw.groupId ?? localParticipantBreakoutGroup;
    },
);

startAppListening({
    actionCreator: signalEvents.breakoutMoveToGroup,
    effect: (_, { dispatch, getState }) => {
        const state = getState();
        const localParticipant = selectLocalParticipantRaw(state);
        const breakoutGroupAssigned = localParticipant.breakoutGroupAssigned;

        if (breakoutGroupAssigned) {
            dispatch(doBreakoutJoin({ group: breakoutGroupAssigned }));
        }
    },
});

startAppListening({
    actionCreator: signalEvents.breakoutMoveToMain,
    effect: (_, { dispatch }) => {
        dispatch(doBreakoutJoin({ group: "" }));
    },
});
