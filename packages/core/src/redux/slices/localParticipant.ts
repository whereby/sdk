import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RoleName } from "@whereby.com/media";
import { RootState } from "../store";
import { createAsyncRoomConnectedThunk, createRoomConnectedThunk } from "../thunk";
import { LocalParticipant } from "../../RoomParticipant";
import { selectSignalConnectionRaw } from "./signalConnection";
import { doAppStart } from "./app";
import { selectLocalMediaStream, toggleCameraEnabled, toggleMicrophoneEnabled } from "./localMedia";
import { createReactor, startAppListening } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";
import { ClientView } from "../types";
import { NON_PERSON_ROLES } from "../constants";

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
    isDialIn: false,
};

/**
 * Reducer
 */

export const localParticipantSlice = createSlice({
    name: "localParticipant",
    initialState,
    reducers: {
        setDisplayName: (state, action: PayloadAction<{ displayName: string }>) => {
            return {
                ...state,
                displayName: action.payload.displayName,
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

/**
 * Action creators
 */

export const { setDisplayName } = localParticipantSlice.actions;

export const doSetDisplayName = createRoomConnectedThunk((payload: { displayName: string }) => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;

    socket?.emit("send_client_metadata", {
        type: "UserData",
        payload: { displayName: payload.displayName },
    });

    dispatch(setDisplayName({ displayName: payload.displayName }));
});

export const doEnableAudio = createAsyncRoomConnectedThunk(
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

export const doEnableVideo = createAsyncRoomConnectedThunk(
    "localParticipant/doEnableVideo",
    async (payload: { enabled: boolean }, { getState }) => {
        const state = getState();
        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("enable_video", { enabled: payload.enabled });

        return payload.enabled;
    },
);

export const doSetLocalStickyReaction = createAsyncRoomConnectedThunk(
    "localParticipant/doSetLocalStickyReaction",
    async (payload: { enabled?: boolean }, { getState, rejectWithValue }) => {
        const state = getState();

        const currentStickyReaction = selectLocalParticipantStickyReaction(state);
        const stickyReactionCurrentlyEnabled = Boolean(currentStickyReaction);
        const enabled = payload.enabled ?? !stickyReactionCurrentlyEnabled;

        if (enabled === stickyReactionCurrentlyEnabled) {
            return rejectWithValue(currentStickyReaction);
        }

        const stickyReaction = enabled ? { reaction: "✋", timestamp: new Date().toISOString() } : null;

        return stickyReaction;
    },
);

export const doSendClientMetadata = createRoomConnectedThunk(() => (_, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;

    const payload = {
        displayName: selectLocalParticipantDisplayName(state),
        stickyReaction: selectLocalParticipantStickyReaction(state),
    };

    socket?.emit("send_client_metadata", {
        type: "UserData",
        payload,
    });
});

/**
 * Selectors
 */

export const selectLocalParticipantRaw = (state: RootState) => state.localParticipant;
export const selectSelfId = (state: RootState) => state.localParticipant.id;
export const selectLocalParticipantDisplayName = (state: RootState) => state.localParticipant.displayName;
export const selectLocalParticipantClientClaim = (state: RootState) => state.localParticipant.clientClaim;
export const selectLocalParticipantIsScreenSharing = (state: RootState) => state.localParticipant.isScreenSharing;
export const selectLocalParticipantStickyReaction = (state: RootState) => state.localParticipant.stickyReaction;

/**
 * Reactors
 */
export const selectLocalParticipantView = createSelector(
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    (participant, localStream) => {
        const clientView: ClientView = {
            id: participant.id,
            clientId: participant.id,
            displayName: participant.displayName,
            stream: localStream,
            isLocalClient: true,
            isAudioEnabled: participant.isAudioEnabled,
            isVideoEnabled: participant.isVideoEnabled,
        };

        if (NON_PERSON_ROLES.includes(participant.roleName)) {
            return null;
        }

        return clientView;
    },
);

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

createReactor([selectLocalParticipantDisplayName, selectLocalParticipantStickyReaction], ({ dispatch }) => {
    dispatch(doSendClientMetadata());
});
