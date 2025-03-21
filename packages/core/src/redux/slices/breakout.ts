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

export const breakoutSliceInitialState: BreakoutState = {
    ...createBreakout(),
    groupId: null,
};

export const breakoutSlice = createSlice({
    name: "breakout",
    initialState: breakoutSliceInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const { error, breakout } = action.payload || {};

            if (error) {
                return state;
            }

            if (breakout) {
                return {
                    ...state,
                    ...createBreakout(breakout),
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
            if (action.meta?.localParticipantId !== action.payload.clientId) {
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
export const selectBreakoutAssignments = (state: RootState) => state.breakout.assignments;
export const selectBreakoutGroups = (state: RootState) => state.breakout.groups;

export const selectBreakoutCurrentId = createSelector(
    selectBreakoutRaw,
    selectLocalParticipantBreakoutGroup,
    (raw, localParticipantBreakoutGroup) => {
        return raw.groupId || localParticipantBreakoutGroup || "";
    },
);

export const selectBreakoutCurrentGroup = createSelector(
    selectBreakoutRaw,
    selectBreakoutCurrentId,
    (raw, breakoutCurrentId) => {
        const name = raw.groups?.[breakoutCurrentId];
        if (!name) return null;
        return { id: breakoutCurrentId, name };
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

startAppListening({
    actionCreator: signalEvents.breakoutSessionUpdated,
    effect: ({ payload }, { dispatch, getState }) => {
        const state = getState();
        const autoMoveToMain = selectBreakoutRaw(state).autoMoveToMain;

        // Special case for the SDK. If the breakout is ended, but there's no config to auto move back to main, we do the auto move here anyways.
        // This is because we don't have any visual hints, to tell the users to move back to the main room after the breakout is ended.
        if (payload.initiatedBy?.active === false) {
            if (!autoMoveToMain) {
                dispatch(doBreakoutJoin({ group: "" }));
            }
        }
    },
});
