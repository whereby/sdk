import { createSelector, createSlice } from "@reduxjs/toolkit";
import { BreakoutConfig, BreakoutSessionUpdateRequest } from "@whereby.com/media";
import { RootState } from "../store";
import { selectSignalConnectionRaw, signalEvents } from "./signalConnection";
import { selectLocalParticipantBreakoutGroup, selectLocalParticipantRaw } from "./localParticipant/selectors";
import { selectIsAuthorizedToManageBreakout } from "./authorization";
import { selectRemoteParticipants } from "./remoteParticipants";
import { selectDeviceId } from "./deviceCredentials";
import { doSetNotification, createNotificationEvent } from "./notifications";
import { BreakoutTimerEventProps } from "./notifications/events";
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

function ensureGracePeriods(state: RootState, payload: BreakoutSessionUpdateRequest): BreakoutSessionUpdateRequest {
    const { moveToGroupGracePeriod, moveToMainGracePeriod } = state.breakout;
    const next = { ...payload };

    if (next.autoMoveToGroup === true && next.moveToGroupGracePeriod == null) {
        next.moveToGroupGracePeriod = moveToGroupGracePeriod ?? 10;
    }
    if (next.autoMoveToMain === true && next.moveToMainGracePeriod == null) {
        next.moveToMainGracePeriod = moveToMainGracePeriod ?? 30;
    }

    return next;
}

function emitBreakoutSessionUpdate(state: RootState, payload: BreakoutSessionUpdateRequest) {
    const { socket } = selectSignalConnectionRaw(state);
    socket?.emit("update_breakout_session", ensureGracePeriods(state, payload));
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
 * Group helpers
 */
export const BREAKOUT_GROUPS_MIN_MAX: [number, number] = [2, 20];
const GROUP_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export function defaultBreakoutGroupName(groupId: string) {
    return `Group ${groupId.toUpperCase()}`;
}

export function createBreakoutGroups(count: number = BREAKOUT_GROUPS_MIN_MAX[0]) {
    const [min, max] = BREAKOUT_GROUPS_MIN_MAX;
    const amount = Math.min(Math.max(count, min), max);
    const groups: { [groupId: string]: string } = {};
    for (let i = 0; i < amount; i++) {
        const id = GROUP_ID_ALPHABET[i];
        groups[id] = defaultBreakoutGroupName(id);
    }
    return groups;
}

function shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
}

function chunk<T>(items: T[], chunkCount: number): T[][] {
    let remaining = [...items];
    let count = chunkCount;
    const chunks: T[][] = [];
    while (remaining.length && count > 0) {
        const size = Math.ceil(remaining.length / count);
        chunks.push(remaining.slice(0, size));
        remaining = remaining.slice(size);
        count -= 1;
    }
    return chunks;
}

function randomizeAssignments(deviceIds: string[], groupIds: string[]) {
    const assignments: { [deviceId: string]: string } = {};
    chunk(deviceIds, groupIds.length).forEach((chunkOfDevices, index) => {
        chunkOfDevices.forEach((deviceId) => {
            assignments[deviceId] = groupIds[index];
        });
    });
    return assignments;
}

export const doAssignAllBreakoutParticipants = createAppAuthorizedThunk<void>(
    (state) => selectIsAuthorizedToManageBreakout(state),
    () => (_, getState) => {
        const state = getState();
        const groupIds = Object.keys(selectBreakoutGroups(state) || {});
        if (!groupIds.length) return;
        const deviceIds = shuffle(selectRemoteParticipants(state).map((participant) => participant.deviceId));
        emitBreakoutSessionUpdate(state, { assignments: randomizeAssignments(deviceIds, groupIds) });
    },
);

export const doUnassignAllBreakoutParticipants = createAppAuthorizedThunk<void>(
    (state) => selectIsAuthorizedToManageBreakout(state),
    () => (_, getState) => {
        const state = getState();
        const assignments = selectBreakoutAssignments(state) || {};
        const cleared = Object.keys(assignments).reduce<{ [deviceId: string]: string }>((acc, deviceId) => {
            acc[deviceId] = "";
            return acc;
        }, {});
        emitBreakoutSessionUpdate(state, { assignments: cleared });
    },
);

export const doShuffleBreakoutParticipants = createAppAuthorizedThunk<void>(
    (state) => selectIsAuthorizedToManageBreakout(state),
    () => (_, getState) => {
        const state = getState();
        const groupIds = Object.keys(selectBreakoutGroups(state) || {});
        if (!groupIds.length) return;
        const assignments = selectBreakoutAssignments(state) || {};
        const deviceIds = shuffle(
            Object.entries(assignments)
                .filter(([, groupId]) => !!groupId)
                .map(([deviceId]) => deviceId),
        );
        emitBreakoutSessionUpdate(state, { assignments: randomizeAssignments(deviceIds, groupIds) });
    },
);

export const doExtendBreakoutTimer = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToManageBreakout(state),
    (payload: { seconds?: number } | void) => (_, getState) => {
        const state = getState();
        const additionalSeconds = payload?.seconds ?? 60;
        const breakoutTimerDuration = (selectBreakoutTimerDuration(state) || 0) + additionalSeconds;
        emitBreakoutSessionUpdate(state, { breakoutTimerDuration });
    },
);

export const doStopBreakoutTimer = createAppAuthorizedThunk<void>(
    (state) => selectIsAuthorizedToManageBreakout(state),
    () => (_, getState) => {
        emitBreakoutSessionUpdate(getState(), { breakoutTimerSetting: false });
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
export const selectBreakoutTimerSetting = (state: RootState) => state.breakout.breakoutTimerSetting;
export const selectBreakoutTimerDuration = (state: RootState) => state.breakout.breakoutTimerDuration;
export const selectBreakoutAutoMoveToGroup = (state: RootState) => state.breakout.autoMoveToGroup;
export const selectBreakoutMoveToGroupGracePeriod = (state: RootState) => state.breakout.moveToGroupGracePeriod;
export const selectBreakoutAutoMoveToMain = (state: RootState) => state.breakout.autoMoveToMain;
export const selectBreakoutMoveToMainGracePeriod = (state: RootState) => state.breakout.moveToMainGracePeriod;
export const selectBreakoutStartedAt = (state: RootState) => state.breakout.startedAt;

export const selectBreakoutEndTime = createSelector(selectBreakoutRaw, (raw) => {
    if (!raw.breakoutStartedAt) return null;
    const startTime = new Date(raw.breakoutStartedAt).getTime();
    const gracePeriod = raw.autoMoveToGroup ? raw.moveToGroupGracePeriod || 0 : 0;
    return startTime + ((raw.breakoutTimerDuration || 0) + gracePeriod) * 1000;
});

export const selectBreakoutMoveToGroupAt = createSelector(selectBreakoutRaw, (raw) => {
    if (!raw.autoMoveToGroup || !raw.breakoutStartedAt) return null;
    return new Date(raw.breakoutStartedAt).getTime() + (raw.moveToGroupGracePeriod || 0) * 1000;
});

export const selectBreakoutMoveToMainAt = createSelector(selectBreakoutRaw, (raw) => {
    if (!raw.autoMoveToMain || !raw.breakoutEndedAt) return null;
    return new Date(raw.breakoutEndedAt).getTime() + (raw.moveToMainGracePeriod || 0) * 1000;
});

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

startAppListening({
    actionCreator: signalEvents.breakoutEnding,
    effect: (_, { dispatch }) => {
        dispatch(
            doSetNotification(
                createNotificationEvent<"breakoutTimerEnding", BreakoutTimerEventProps>({
                    type: "breakoutTimerEnding",
                    message: "The breakout session is ending soon",
                    props: {},
                }),
            ),
        );
    },
});

startAppListening({
    actionCreator: signalEvents.breakoutTimerExtended,
    effect: (_, { dispatch }) => {
        dispatch(
            doSetNotification(
                createNotificationEvent<"breakoutTimerExtended", BreakoutTimerEventProps>({
                    type: "breakoutTimerExtended",
                    message: "The breakout timer was extended",
                    props: {},
                }),
            ),
        );
    },
});

startAppListening({
    actionCreator: signalEvents.breakoutTimerEnded,
    effect: (_, { dispatch }) => {
        dispatch(
            doSetNotification(
                createNotificationEvent<"breakoutTimerEnded", BreakoutTimerEventProps>({
                    type: "breakoutTimerEnded",
                    message: "The breakout timer ended",
                    props: {},
                }),
            ),
        );
    },
});
