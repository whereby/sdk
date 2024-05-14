import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppAuthorizedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { doAppStop } from "./app";
import {
    selectIsAuthorizedToLockRoom,
    selectIsAuthorizedToKickClient,
    selectIsAuthorizedToEndMeeting,
} from "./authorization";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectRemoteClientViews, selectRemoteParticipants } from "./remoteParticipants";
import { selectLocalParticipantView } from "./localParticipant";

/**
 * Reducer
 */

export interface RoomState {
    isLocked: boolean;
}

const initialState: RoomState = {
    isLocked: false,
};

export const roomSlice = createSlice({
    name: "room",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const { error, isLocked } = action.payload;

            if (error) {
                return state;
            }

            return {
                ...state,
                isLocked: Boolean(isLocked),
            };
        });

        builder.addCase(signalEvents.roomLocked, (state, action) => {
            const { isLocked } = action.payload;

            return {
                ...state,
                isLocked: Boolean(isLocked),
            };
        });
    },
});

/**
 * Action creators
 */

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

        if (clientsToKick.length) {
            const { socket } = selectSignalConnectionRaw(state);

            socket?.emit("kick_client", { clientIds: clientsToKick, reasonId: "end-meeting" });
        }

        if (!payload.stayBehind) {
            dispatch(doAppStop());
        }
    },
);

/**
 * Selectors
 */

export const selectRoomIsLocked = (state: RootState) => state.room.isLocked;
export const selectAllClientViews = createSelector(
    selectLocalParticipantView,
    selectRemoteClientViews,
    (localParticipant, remoteParticipants) => {
        return [localParticipant, ...remoteParticipants];
    },
);
