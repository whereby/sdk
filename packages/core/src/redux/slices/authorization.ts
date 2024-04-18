import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RoleName } from "@whereby.com/media";
import { RootState } from "../store";
import { signalEvents } from "./signalConnection/actions";

const ROOM_ACTION_PERMISSIONS_BY_ROLE: { [permissionKey: string]: Array<RoleName> } = {
    canLockRoom: ["host"],
    canRequestAudioEnable: ["host"],
    canKickClient: ["host"],
    canEndMeeting: ["host"],
};

/**
 * Reducer
 */

export interface AuthorizationState {
    roleName: RoleName;
}

const initialState: AuthorizationState = {
    roleName: "none",
};

export const authorizationSlice = createSlice({
    name: "authorization",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const client = action.payload?.room?.clients.find((c) => c.id === action.payload?.selfId);
            return {
                ...state,
                roleName: client?.role.roleName || "none",
            };
        });
    },
});

/**
 * Selectors
 */

export const selectAuthorizationRoleName = (state: RootState) => state.authorization.roleName;

export const selectIsAuthorizedToLockRoom = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canLockRoom.includes(localParticipantRole),
);
export const selectIsAuthorizedToRequestAudioEnable = createSelector(
    selectAuthorizationRoleName,
    (localParticipantRole) => ROOM_ACTION_PERMISSIONS_BY_ROLE.canRequestAudioEnable.includes(localParticipantRole),
);
export const selectIsAuthorizedToKickClient = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canKickClient.includes(localParticipantRole),
);
export const selectIsAuthorizedToEndMeeting = createSelector(selectAuthorizationRoleName, (localParticipantRole) =>
    ROOM_ACTION_PERMISSIONS_BY_ROLE.canEndMeeting.includes(localParticipantRole),
);
