import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RoleName } from "@whereby.com/media";
import { RootState } from "../store";
import { signalEvents } from "./signalConnection/actions";
import { doAppStart } from "./app";

const ROOM_ACTION_PERMISSIONS_BY_ROLE: { [permissionKey: string]: Array<RoleName> } = {
    canLockRoom: ["host"],
    canRequestAudioEnable: ["host"],
    canRequestVideoEnable: ["host"],
    canKickClient: ["host"],
    canEndMeeting: ["host"],
    canAskToSpeak: ["host"],
    canSpotlight: ["host"],
};

/**
 * Reducer
 */

export interface AuthorizationState {
    roomKey: string | null;
    assistantKey?: string | null;
    roleName: RoleName;
}

export const authorizationSliceInitialState: AuthorizationState = {
    roomKey: null,
    assistantKey: null,
    roleName: "none",
};

export const authorizationSlice = createSlice({
    name: "authorization",
    initialState: authorizationSliceInitialState,
    reducers: {
        setRoomKey: (state, action: PayloadAction<string | null>) => {
            return {
                ...state,
                roomKey: action.payload,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(doAppStart, (state, action) => {
            return {
                ...state,
                roomKey: action.payload.roomKey,
                assistantKey: action.payload.assistantKey,
            };
        });

        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if ("error" in action.payload) {
                return state;
            }

            const { room, selfId } = action.payload || {};

            const client = room?.clients.find((c) => c.id === selfId);

            if (client) {
                return {
                    ...state,
                    roleName: client?.role.roleName || "none",
                };
            }

            return state;
        });
    },
});

/**
 * Action creators
 */

export const { setRoomKey } = authorizationSlice.actions;

/**
 * Selectors
 */

export const selectRoomKey = (state: RootState) => state.authorization.roomKey;
export const selectAssistantKey = (state: RootState) => state.authorization.assistantKey;

export const selectAuthorizationRoleName = (state: RootState) => state.authorization.roleName;

export const selectIsAuthorizedToLockRoom = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canLockRoom.includes(localParticipantRole),
);
export const selectIsAuthorizedToRequestAudioEnable = createSelector(
    selectAuthorizationRoleName,
    (localParticipantRole) => ROOM_ACTION_PERMISSIONS_BY_ROLE.canRequestAudioEnable.includes(localParticipantRole),
);
export const selectIsAuthorizedToRequestVideoEnable = createSelector(
    selectAuthorizationRoleName,
    (localParticipantRole) => ROOM_ACTION_PERMISSIONS_BY_ROLE.canRequestVideoEnable.includes(localParticipantRole),
);
export const selectIsAuthorizedToKickClient = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canKickClient.includes(localParticipantRole),
);
export const selectIsAuthorizedToEndMeeting = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canEndMeeting.includes(localParticipantRole),
);
export const selectIsAuthorizedToAskToSpeak = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canAskToSpeak.includes(localParticipantRole),
);
export const selectIsAuthorizedToSpotlight = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canSpotlight.includes(localParticipantRole),
);
