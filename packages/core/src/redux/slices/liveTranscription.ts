import { createSlice } from "@reduxjs/toolkit";

import { RootState } from "../store";

import { signalEvents } from "./signalConnection/actions";

/**
 * Reducer
 */
export interface LiveTranscriptionState {
    transcriptionId: string | null;
    status: "started" | "stopped";
    startedAt: number | null;
}

export const initialLiveTranscriptionState: LiveTranscriptionState = {
    transcriptionId: null,
    status: "stopped",
    startedAt: null,
};

export const liveTranscriptionSlice = createSlice({
    name: "cloudRecording",
    initialState: initialLiveTranscriptionState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(signalEvents.liveTranscriptionStopped, (state) => {
            return {
                ...state,
                transcriptionId: null,
                status: "stopped",
                startedAt: null,
            };
        });
        builder.addCase(signalEvents.liveTranscriptionStarted, (state, action) => {
            const { payload } = action;

            return {
                ...state,
                status: "started",
            };
        });
    },
});

export const selectLiveTranscriptionRaw = (state: RootState) => state.liveTranscription;
