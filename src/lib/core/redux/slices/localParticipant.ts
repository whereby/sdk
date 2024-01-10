import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppAsyncThunk } from "../thunk";
import { LocalParticipant } from "../../../../lib/react";
import { selectSignalConnectionRaw } from "./signalConnection";

import { doAppJoin } from "./app";
import { doToggleCameraEnabled, doToggleMicrophoneEnabled } from "./localMedia";
import { startAppListening } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";

export interface LocalParticipantState extends LocalParticipant {
    isScreenSharing: boolean;
}

const initialState: LocalParticipantState = {
    displayName: "",
    id: "",
    isAudioEnabled: true,
    isVideoEnabled: true,
    isLocalParticipant: true,
    stream: undefined,
    isScreenSharing: false,
};

export const doEnableAudio = createAppAsyncThunk(
    "localParticipant/doEnableAudio",
    async (payload: { enabled: boolean }, { getState }) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("enable_audio", { enabled: payload.enabled });

        return payload.enabled;
    }
);

export const doEnableVideo = createAppAsyncThunk(
    "localParticipant/doEnableVideo",
    async (payload: { enabled: boolean }, { getState }) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("enable_video", { enabled: payload.enabled });

        return payload.enabled;
    }
);

export const doSetDisplayName = createAppAsyncThunk(
    "localParticipant/doSetDisplayName",
    async (payload: { displayName: string }, { getState }) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("send_client_metadata", {
            type: "UserData",
            payload,
        });

        return payload.displayName;
    }
);

export const localParticipantSlice = createSlice({
    name: "localParticipant",
    initialState,
    reducers: {
        doSetLocalParticipant: (state, action: PayloadAction<LocalParticipant>) => {
            return {
                ...state,
                ...action.payload,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(doAppJoin, (state, action) => {
            return {
                ...state,
                displayName: action.payload.displayName,
            };
        });

        builder.addCase(doEnableAudio.fulfilled, (state, action) => {
            return {
                ...state,
                isAudioEnabled: action.payload,
            };
        });
        builder.addCase(doEnableVideo.fulfilled, (state, action) => {
            return {
                ...state,
                isVideoEnabled: action.payload,
            };
        });
        builder.addCase(doSetDisplayName.fulfilled, (state, action) => {
            return {
                ...state,
                displayName: action.payload,
            };
        });
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            return {
                ...state,
                id: action.payload.selfId,
            };
        });
    },
});

export const { doSetLocalParticipant } = localParticipantSlice.actions;

export const selectLocalParticipantRaw = (state: RootState) => state.localParticipant;
export const selectSelfId = (state: RootState) => state.localParticipant.id;
export const selectLocalParticipantIsScreenSharing = (state: RootState) => state.localParticipant.isScreenSharing;

startAppListening({
    actionCreator: doToggleCameraEnabled,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enabled } = payload;
        const { isVideoEnabled } = selectLocalParticipantRaw(getState());

        dispatch(doEnableVideo({ enabled: enabled || !isVideoEnabled }));
    },
});

startAppListening({
    actionCreator: doToggleMicrophoneEnabled,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enabled } = payload;
        const { isAudioEnabled } = selectLocalParticipantRaw(getState());

        dispatch(doEnableAudio({ enabled: enabled || !isAudioEnabled }));
    },
});