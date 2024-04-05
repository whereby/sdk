import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppAuthorizedThunk } from "../thunk";
import { doAppJoin } from "./app";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectLocalParticipantRole } from "./localParticipant";

type AvailableRoles = "none" | "visitor" | "granted_visitor" | "viewer" | "granted_viewer" | "host";

const AUTHORIZED_ACTION_ROLES: { [permissionKey: string]: Array<AvailableRoles> } = {
    canLockRoom: ["host"],
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

/**
 * Selectors
 */

export const selectAuthorizationRoomKey = (state: RootState) => state.authorization.roomKey;

export const selectAuthorizationRoomLocked = (state: RootState) => state.authorization.roomLocked;

export const selectIsAuthorizedToLockRoom = createSelector(selectLocalParticipantRole, (localParticipantRole) =>
    AUTHORIZED_ACTION_ROLES.canLockRoom.includes(localParticipantRole as AvailableRoles),
);
