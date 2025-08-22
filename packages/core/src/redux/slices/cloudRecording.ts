import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createRoomConnectedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";

/**
 * Reducer
 */
export interface CloudRecordingState {
    isInitiator: boolean;
    isRecording: boolean;
    error: unknown;
    status?: "recording" | "requested" | "error";
    startedAt?: number;
}

export const initialCloudRecordingState: CloudRecordingState = {
    isInitiator: false,
    isRecording: false,
    error: null,
    startedAt: undefined,
};

export const cloudRecordingSlice = createSlice({
    name: "cloudRecording",
    initialState: initialCloudRecordingState,
    reducers: {
        recordingRequestStarted: (state) => {
            return {
                ...state,
                isInitiator: true,
                status: "requested",
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.cloudRecordingStopped, (state) => {
            return {
                ...state,
                isInitiator: false,
                isRecording: false,
                status: undefined,
            };
        });
        builder.addCase(signalEvents.cloudRecordingStarted, (state, action) => {
            const { payload } = action;

            if (!payload.error) {
                return state;
            }

            return {
                ...state,
                isInitiator: false,
                isRecording: false,
                status: "error",
                error: payload.error,
            };
        });

        builder.addCase(signalEvents.newClient, (state, { payload }) => {
            const { client } = payload;
            if (client.role?.roleName === "recorder") {
                return {
                    ...state,
                    isRecording: true,
                    status: "recording",
                    startedAt: client.startedCloudRecordingAt
                        ? new Date(client.startedCloudRecordingAt).getTime()
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
export const { recordingRequestStarted } = cloudRecordingSlice.actions;

export const doStartCloudRecording = createRoomConnectedThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const status = selectCloudRecordingStatus(state);

    if (status && ["recording", "requested"].includes(status)) {
        return;
    }

    socket?.emit("start_recording", {
        recording: "cloud",
    });

    dispatch(recordingRequestStarted());
});

export const doStopCloudRecording = createRoomConnectedThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;

    socket?.emit("stop_recording");
});

/**
 * Selectors
 */
export const selectCloudRecordingRaw = (state: RootState) => state.cloudRecording;
export const selectCloudRecordingStatus = (state: RootState) => state.cloudRecording.status;
export const selectCloudRecordingStartedAt = (state: RootState) => state.cloudRecording.startedAt;
export const selectCloudRecordingError = (state: RootState) => state.cloudRecording.error;
export const selectIsCloudRecording = (state: RootState) => state.cloudRecording.isRecording;
export const selectCloudRecordingIsInitiator = (state: RootState) => state.cloudRecording.isInitiator;
