import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppAuthorizedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import {
    selectIsAuthorizedToLockRoom,
    selectIsAuthorizedToKickClient,
    selectIsAuthorizedToEndMeeting,
} from "./authorization";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectRemoteParticipants } from "./remoteParticipants";
import { doAppJoin } from "./app";

/**
 * Reducer
 */

export interface RoomState {
    roomKey: string | null;
    isLocked: boolean;
}

const initialState: RoomState = {
    roomKey: null,
    isLocked: false,
};

export const roomSlice = createSlice({
    name: "room",
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

export const { setRoomKey } = roomSlice.actions;

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
    () => (_, getState) => {
        const state = getState();

        const clientsToKick = selectRemoteParticipants(state).map((c) => c.id);

        const { socket } = selectSignalConnectionRaw(state);

        socket?.emit("kick_client", { clientIds: clientsToKick, reasonId: "end-meeting" });
    },
);

/**
 * Selectors
 */

export const selectRoomKey = (state: RootState) => state.room.roomKey;

export const selectRoomIsLocked = (state: RootState) => state.room.isLocked;
