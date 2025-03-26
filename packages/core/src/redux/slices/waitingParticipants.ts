import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { WaitingParticipant } from "../../RoomParticipant";
import { createRoomConnectedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionSocket } from "./signalConnection";

/**
 * Reducer
 */
export interface WaitingParticipantsState {
    waitingParticipants: WaitingParticipant[];
}

export const waitingParticipantsSliceInitialState: WaitingParticipantsState = {
    waitingParticipants: [],
};

export const waitingParticipantsSlice = createSlice({
    name: "waitingParticipants",
    initialState: waitingParticipantsSliceInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if ("error" in action.payload) {
                return state;
            }

            const { room } = action.payload;

            if (room.knockers.length) {
                return {
                    ...state,
                    waitingParticipants: room.knockers.map((knocker) => ({
                        id: knocker.clientId,
                        displayName: knocker.displayName,
                    })),
                };
            }

            return state;
        });

        builder.addCase(signalEvents.roomKnocked, (state, action) => {
            const { clientId, displayName } = action.payload;
            return {
                ...state,
                waitingParticipants: [...state.waitingParticipants, { id: clientId, displayName }],
            };
        });
        builder.addCase(signalEvents.knockerLeft, (state, action) => {
            const { clientId } = action.payload;
            return {
                ...state,
                waitingParticipants: state.waitingParticipants.filter((p) => p.id !== clientId),
            };
        });
    },
});

/**
 * Action creators
 */

export const doAcceptWaitingParticipant = createRoomConnectedThunk(
    (payload: { participantId: string }) => (dispatch, getState) => {
        const { participantId } = payload;
        const state = getState();
        const socket = selectSignalConnectionSocket(state);

        socket?.emit("handle_knock", {
            action: "accept",
            clientId: participantId,
            response: {},
        });
    },
);

export const doRejectWaitingParticipant = createRoomConnectedThunk(
    (payload: { participantId: string }) => (dispatch, getState) => {
        const { participantId } = payload;
        const state = getState();
        const socket = selectSignalConnectionSocket(state);

        socket?.emit("handle_knock", {
            action: "reject",
            clientId: participantId,
            response: {},
        });
    },
);

/**
 * Selectors
 */

export const selectWaitingParticipantsRaw = (state: RootState) => state.waitingParticipants;
export const selectWaitingParticipants = (state: RootState) => state.waitingParticipants.waitingParticipants;
