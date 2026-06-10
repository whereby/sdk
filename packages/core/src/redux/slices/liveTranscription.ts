import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createRoomConnectedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";

/**
 * Reducer
 */
export interface LiveTranscriptionState {
    isInitiator: boolean;
    isTranscribing: boolean;
    error?: string;
    status?: "transcribing" | "requested" | "error";
    startedAt?: number;
}

export const initialLiveTranscriptionState: LiveTranscriptionState = {
    isInitiator: false,
    isTranscribing: false,
    startedAt: undefined,
};

export const liveTranscriptionSlice = createSlice({
    name: "liveTranscription",
    initialState: initialLiveTranscriptionState,
    reducers: {
        transcribingRequestStarted: (state) => {
            return {
                ...state,
                isInitiator: true,
                status: "requested",
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.liveTranscriptionStopped, (state) => {
            return {
                ...state,
                isInitiator: false,
                isTranscribing: false,
                status: undefined,
            };
        });
        builder.addCase(signalEvents.liveTranscriptionStarted, (state, action) => {
            const { payload } = action;

            if (payload.error) {
                return {
                    ...state,
                    isInitiator: false,
                    isTranscribing: false,
                    status: "error",
                    error: payload.error,
                };
            }

            return {
                ...state,
                isTranscribing: true,
                status: "transcribing",
                startedAt: new Date().getTime(),
            };
        });

        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if ("error" in action.payload) {
                return state;
            }

            const { room } = action.payload || {};

            return {
                ...state,
                isTranscribing: Boolean(room?.liveTranscriptionId),
                status: room?.liveTranscriptionId ? "transcribing" : state.status,
                startedAt: room?.liveTranscriptionId ? new Date().getTime() : state.startedAt,
            };
        });
    },
});

/**
 * Action creators
 */
export const { transcribingRequestStarted } = liveTranscriptionSlice.actions;

export const doStartLiveTranscription = createRoomConnectedThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const status = selectLiveTranscriptionStatus(state);

    if (status && ["transcribing", "requested"].includes(status)) {
        return;
    }

    socket?.emit("start_live_transcription");

    dispatch(transcribingRequestStarted());
});

export const doStopLiveTranscription = createRoomConnectedThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;

    socket?.emit("stop_live_transcription");
});

/**
 * Selectors
 */
export const selectLiveTranscriptionRaw = (state: RootState) => state.liveTranscription;
export const selectLiveTranscriptionStatus = (state: RootState) => state.liveTranscription.status;
export const selectLiveTranscriptionStartedAt = (state: RootState) => state.liveTranscription.startedAt;
export const selectLiveTranscriptionError = (state: RootState) => state.liveTranscription.error;
export const selectIsLiveTranscription = (state: RootState) => state.liveTranscription.isTranscribing;
export const selectLiveTranscriptionIsInitiator = (state: RootState) => state.liveTranscription.isInitiator;
