import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RoleName } from "@whereby.com/media";
import { RootState } from "../store";
import { createAppAsyncThunk } from "../thunk";
import { LocalParticipant } from "../../RoomParticipant";
import { selectSignalConnectionRaw } from "./signalConnection";
import { doAppStart } from "./app";
import { toggleCameraEnabled, toggleMicrophoneEnabled } from "./localMedia";
import { startAppListening } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";
import { doSetNotification } from "./notifications";

export interface LocalParticipantState extends LocalParticipant {
    isScreenSharing: boolean;
    roleName: RoleName;
    clientClaim?: string;
}

const initialState: LocalParticipantState = {
    displayName: "",
    id: "",
    isAudioEnabled: true,
    isVideoEnabled: true,
    isLocalParticipant: true,
    stream: undefined,
    isScreenSharing: false,
    roleName: "none",
    clientClaim: undefined,
    stickyReaction: undefined,
};

export const doEnableAudio = createAppAsyncThunk(
    "localParticipant/doEnableAudio",
    async (payload: { enabled: boolean }, { dispatch, getState }) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("enable_audio", { enabled: payload.enabled });

        if (payload.enabled) {
            dispatch(doSetLocalStickyReaction({ enabled: false }));
        }

        return payload.enabled;
    },
);

export const doEnableVideo = createAppAsyncThunk(
    "localParticipant/doEnableVideo",
    async (payload: { enabled: boolean }, { getState }) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("enable_video", { enabled: payload.enabled });

        return payload.enabled;
    },
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
    },
);

export const doSetLocalStickyReaction = createAppAsyncThunk(
    "localParticipant/doSetLocalStickyReaction",
    async (payload: { enabled?: boolean }, { dispatch, getState, rejectWithValue }) => {
        const state = getState();

        const currentStickyReaction = selectLocalParticipantStickyReaction(state);
        const stickyReactionCurrentlyEnabled = Boolean(currentStickyReaction);
        const enabled = payload.enabled ?? !stickyReactionCurrentlyEnabled;

        if (enabled === stickyReactionCurrentlyEnabled) {
            return rejectWithValue(currentStickyReaction);
        }

        const stickyReaction = enabled ? { reaction: "✋", timestamp: new Date().toISOString() } : null;

        const socket = selectSignalConnectionRaw(state).socket;
        socket?.emit("send_client_metadata", {
            type: "UserData",
            payload: {
                stickyReaction,
            },
        });

        dispatch(
            doSetNotification({
                type: enabled ? "localHandRaised" : "localHandLowered",
                message: `You ${enabled ? "raised" : "lowered"} your hand`,
            }),
        );

        return stickyReaction;
    },
);

export const localParticipantSlice = createSlice({
    name: "localParticipant",
    initialState,
    reducers: {
        doSetLocalParticipant: (state, action: PayloadAction<Partial<LocalParticipant>>) => {
            return {
                ...state,
                ...action.payload,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(doAppStart, (state, action) => {
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
        builder.addCase(doSetLocalStickyReaction.fulfilled, (state, action) => {
            return {
                ...state,
                stickyReaction: action.payload,
            };
        });
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const client = action.payload?.room?.clients.find((c) => c.id === action.payload?.selfId);
            return {
                ...state,
                id: action.payload.selfId,
                roleName: client?.role.roleName || "none",
                clientClaim: action.payload.clientClaim,
            };
        });
    },
});

export const { doSetLocalParticipant } = localParticipantSlice.actions;

export const selectLocalParticipantRaw = (state: RootState) => state.localParticipant;
export const selectSelfId = (state: RootState) => state.localParticipant.id;
export const selectLocalParticipantClientClaim = (state: RootState) => state.localParticipant.clientClaim;
export const selectLocalParticipantIsScreenSharing = (state: RootState) => state.localParticipant.isScreenSharing;
export const selectLocalParticipantStickyReaction = (state: RootState) => state.localParticipant.stickyReaction;

startAppListening({
    actionCreator: toggleCameraEnabled,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enabled } = payload;
        const { isVideoEnabled } = selectLocalParticipantRaw(getState());

        dispatch(doEnableVideo({ enabled: enabled || !isVideoEnabled }));
    },
});

startAppListening({
    actionCreator: toggleMicrophoneEnabled,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enabled } = payload;
        const { isAudioEnabled } = selectLocalParticipantRaw(getState());

        dispatch(doEnableAudio({ enabled: enabled || !isAudioEnabled }));
    },
});
