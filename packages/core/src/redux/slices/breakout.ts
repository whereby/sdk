import { createSelector, createSlice } from "@reduxjs/toolkit";
import { BreakoutConfig, BreakoutSessionUpdateRequest } from "@whereby.com/media";
import { RootState } from "../store";
import { selectSignalConnectionRaw, signalEvents } from "./signalConnection";
import { selectLocalParticipantBreakoutGroup, selectLocalParticipantRaw } from "./localParticipant/selectors";
import { selectIsAuthorizedToManageBreakout } from "./authorization";
import { selectRemoteParticipants } from "./remoteParticipants";
import { selectDeviceId } from "./deviceCredentials";
import { startAppListening } from "../listenerMiddleware";
import { createAppThunk, createAppAuthorizedThunk } from "../thunk";

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
            if ("error" in action.payload) {
                return state;
            }

            const { breakout } = action.payload || {};

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

export interface BreakoutSessionSettings {
    enforceAssignment?: boolean;
    autoMoveToGroup?: boolean;
    autoMoveToMain?: boolean;
    moveToGroupGracePeriod?: number | null;
    moveToMainGracePeriod?: number | null;
    breakoutTimerSetting?: boolean;
    breakoutTimerDuration?: number;
}

export interface StartBreakoutSessionOptions extends BreakoutSessionSettings {
    groups: { [groupId: string]: string };
    assignments?: { [clientId: string]: string };
}

export interface UpdateBreakoutSessionOptions extends BreakoutSessionSettings {
    groups?: { [groupId: string]: string };
    assignments?: { [clientId: string]: string };
}

function emitBreakoutSessionUpdate(state: RootState, payload: BreakoutSessionUpdateRequest) {
    const { socket } = selectSignalConnectionRaw(state);
    socket?.emit("update_breakout_session", payload);
}

function resolveClientAssignmentsToDeviceAssignments(
    state: RootState,
    clientAssignments: { [clientId: string]: string },
) {
    const deviceIdByClientId: { [clientId: string]: string } = {};
    for (const participant of selectRemoteParticipants(state)) {
        deviceIdByClientId[participant.id] = participant.deviceId;
    }
    const localParticipant = selectLocalParticipantRaw(state);
    const localDeviceId = selectDeviceId(state);
    if (localParticipant.id && localDeviceId) {
        deviceIdByClientId[localParticipant.id] = localDeviceId;
    }

    const deviceAssignments: { [deviceId: string]: string } = {};
    for (const [clientId, group] of Object.entries(clientAssignments)) {
        const deviceId = deviceIdByClientId[clientId];
        if (deviceId) {
            deviceAssignments[deviceId] = group;
        }
    }
    return deviceAssignments;
}

export const doStartBreakoutSession = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToManageBreakout(state),
    (payload: StartBreakoutSessionOptions) => (_, getState) => {
        const state = getState();
        const { assignments, ...rest } = payload;
        emitBreakoutSessionUpdate(state, {
            ...rest,
            ...(assignments ? { assignments: resolveClientAssignmentsToDeviceAssignments(state, assignments) } : {}),
            active: true,
        });
    },
);

export const doUpdateBreakoutSession = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToManageBreakout(state),
    (payload: UpdateBreakoutSessionOptions) => (_, getState) => {
        const state = getState();
        const { assignments, ...rest } = payload;
        emitBreakoutSessionUpdate(state, {
            ...rest,
            ...(assignments ? { assignments: resolveClientAssignmentsToDeviceAssignments(state, assignments) } : {}),
        });
    },
);

export const doStopBreakoutSession = createAppAuthorizedThunk<void>(
    (state) => selectIsAuthorizedToManageBreakout(state),
    () => (_, getState) => {
        emitBreakoutSessionUpdate(getState(), { active: false });
    },
);

export const doAssignBreakoutParticipants = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToManageBreakout(state),
    (payload: { assignments: { [clientId: string]: string } }) => (_, getState) => {
        const state = getState();
        const deviceAssignments = resolveClientAssignmentsToDeviceAssignments(state, payload.assignments);
        const mergedAssignments = { ...(selectBreakoutAssignments(state) || {}), ...deviceAssignments };
        emitBreakoutSessionUpdate(state, { assignments: mergedAssignments });
    },
);

/**
 * Selectors
 */
export const selectBreakoutRaw = (state: RootState) => state.breakout;
export const selectBreakoutInitiatedBy = (state: RootState) => state.breakout.initiatedBy;
export const selectBreakoutActive = (state: RootState) => !!state.breakout.startedAt;
export const selectBreakoutAssignments = (state: RootState) => state.breakout.assignments;
export const selectBreakoutGroups = (state: RootState) => state.breakout.groups;
export const selectBreakoutEnforceAssignment = (state: RootState) => state.breakout.enforceAssignment;

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
