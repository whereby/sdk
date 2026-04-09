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
    transcriptionId?: string;
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

            if (!payload.error) {
                return state;
            }

            return {
                ...state,
                isInitiator: false,
                isTranscribing: false,
                status: "error",
                error: payload.error,
                transcriptionId: payload.transcriptionId,
            };
        });

        builder.addCase(signalEvents.newClient, (state, { payload }) => {
            const { client } = payload;
            if (client.role?.roleName === "captioner") {
                return {
                    ...state,
                    isTranscribing: true,
                    status: "transcribing",
                    startedAt: client.startedLiveTranscriptionAt
                        ? new Date(client.startedLiveTranscriptionAt).getTime()
                        : new Date().getTime(),
                };
            }
            return state;
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
