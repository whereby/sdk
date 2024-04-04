import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";
import { doAppJoin } from "./app";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { parseUnverifiedRoomKeyData } from "./../../utils";

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

export const doLockRoom = createAppThunk((payload: { locked: boolean }) => (_, getState) => {
    const state = getState();

    const roomKey = selectAuthorizationRoomKey(state);
    if (!roomKey) {
        console.warn("No room key present");
        return;
    }

    const { roomKeyType } = parseUnverifiedRoomKeyData(roomKey);
    if (roomKeyType !== "meetingHost") {
        console.warn("Only a host can perform this action");
        return;
    }

    const { socket } = selectSignalConnectionRaw(state);
    socket?.emit("set_lock", { locked: payload.locked });
});

/**
 * Selectors
 */
export const selectAuthorizationRoomKey = (state: RootState) => state.authorization.roomKey;
export const selectAuthorizationRoomLocked = (state: RootState) => state.authorization.roomLocked;
