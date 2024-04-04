import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectLocalParticipantRole } from "./localParticipant";

/**
 * Reducer
 */

export interface RoomLockedState {
    locked: boolean;
}

const initialState: RoomLockedState = {
    locked: false,
};

export const roomLockSlice = createSlice({
    name: "roomLock",
    initialState,
    reducers: {},
    extraReducers(builder) {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const { error, isLocked } = action.payload;

            if (error) {
                return state;
            }

            return {
                ...state,
                locked: isLocked,
            };
        });

        builder.addCase(signalEvents.roomLocked, (state, action) => {
            const { isLocked } = action.payload;

            return {
                ...state,
                locked: isLocked,
            };
        });
    },
});

/**
 * Action creators
 */

export const doLockRoom = createAppThunk((payload: { locked: boolean }) => (_, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;

    const localParticipantRole = selectLocalParticipantRole(state);

    if (localParticipantRole !== "host") {
        console.warn("Only a host can lock this room");
        return;
    }

    socket?.emit("set_lock", { locked: payload.locked });
});

/**
 * Selectors
 */

export const selectRoomLocked = (state: RootState) => state.roomLock.locked;
