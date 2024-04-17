import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RoleName } from "@whereby.com/media";
import { RootState } from "../store";
import { createAppAuthorizedThunk } from "../thunk";
import { doAppJoin } from "./app";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectLocalParticipantRole } from "./localParticipant";
import { selectRemoteParticipants } from "./remoteParticipants";

const ACTION_PERMISSIONS_BY_ROLE: { [permissionKey: string]: Array<RoleName> } = {
    canLockRoom: ["host"],
    canRequestAudioEnable: ["host"],
    canKickClient: ["host"],
    canEndMeeting: ["host"],
};

/**
 * Reducer
 */

export interface AuthorizationState {
    roomKey: string | null;
    roomLocked: boolean;
}

const initialState: AuthorizationState = {
    roomKey: null,
    roomLocked: false,
};

export const authorizationSlice = createSlice({
    name: "authorization",
    initialState,
    reducers: {
        setRoomKey: (state, action: PayloadAction<string | null>) => {
            return {
                ...state,
                roomKey: action.payload,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(doAppJoin, (state, action) => {
            return {
                ...state,
                roomKey: action.payload.roomKey,
            };
        });

        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const { error, isLocked } = action.payload;

            if (error) {
                return state;
            }

            return {
                ...state,
                roomLocked: isLocked,
            };
        });

        builder.addCase(signalEvents.roomLocked, (state, action) => {
            const { isLocked } = action.payload;

            return {
                ...state,
                roomLocked: isLocked,
            };
        });
    },
});

/**
 * Action creators
 */

export const { setRoomKey } = authorizationSlice.actions;

export const doLockRoom = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToLockRoom(state),
    (payload: { locked: boolean }) => (_, getState) => {
        const state = getState();

        const { socket } = selectSignalConnectionRaw(state);
        socket?.emit("set_lock", { locked: payload.locked });
    },
);

export const doKickParticipant = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToKickClient(state),
    (payload: { clientId: string }) => (_, getState) => {
        const state = getState();

        const { socket } = selectSignalConnectionRaw(state);
        socket?.emit("kick_client", { clientId: payload.clientId, reasonId: "kick" });
    },
);

export const doEndMeeting = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToEndMeeting(state),
    (payload: { stayBehind?: boolean }) => (dispatch, getState) => {
        const state = getState();

        const clientsToKick = selectRemoteParticipants(state).map((c) => c.id);

        const { socket } = selectSignalConnectionRaw(state);

        socket?.emit("kick_client", { clientIds: clientsToKick, reasonId: "end-meeting" });

        dispatch({
            type: "END_MEETING",
            payload: { requestedByClientId: payload.stayBehind ? null : selectSelfId(state) },
        });

        // TODO: need to first implement leave room action
        // if (!stayBehind) {
        //     doLeaveRoom();
        // }
    },
);

/**
 * Selectors
 */

export const selectAuthorizationRoomKey = (state: RootState) => state.authorization.roomKey;
export const selectAuthorizationRoomLocked = (state: RootState) => state.authorization.roomLocked;
export const selectIsAuthorizedToLockRoom = createSelector(selectLocalParticipantRole, (localParticipantRole) =>
    ACTION_PERMISSIONS_BY_ROLE.canLockRoom.includes(localParticipantRole),
);
export const selectIsAuthorizedToRequestAudioEnable = createSelector(
    selectLocalParticipantRole,
    (localParticipantRole) => ACTION_PERMISSIONS_BY_ROLE.canRequestAudioEnable.includes(localParticipantRole),
);
export const selectIsAuthorizedToKickClient = createSelector(selectLocalParticipantRole, (localParticipantRole) =>
    ACTION_PERMISSIONS_BY_ROLE.canKickClient.includes(localParticipantRole),
);
export const selectIsAuthorizedToEndMeeting = createSelector(selectLocalParticipantRole, (localParticipantRole) =>
    ACTION_PERMISSIONS_BY_ROLE.canEndMeeting.includes(localParticipantRole),
);
