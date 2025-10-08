import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RoleName } from "@whereby.com/media";
import { createAsyncRoomConnectedThunk, createRoomConnectedThunk } from "../../thunk";
import { LocalParticipant } from "../../../RoomParticipant";
import { selectSignalConnectionRaw } from "../signalConnection";
import { doAppStart, selectAppIsAssistant } from "../app";
import { toggleCameraEnabled, toggleMicrophoneEnabled } from "../localMedia";
import { createReactor, startAppListening } from "../../listenerMiddleware";
import { signalEvents } from "../signalConnection/actions";
import { selectRoomConnectionStatus } from "../roomConnection/selectors";
import { selectBreakoutAssignments } from "../breakout";
import { selectDeviceId } from "../deviceCredentials";
import {
    selectLocalParticipantDisplayName,
    selectLocalParticipantRaw,
    selectLocalParticipantStickyReaction,
} from "./selectors";

export interface LocalParticipantState extends LocalParticipant {
    isScreenSharing: boolean;
    roleName: RoleName;
    clientClaim?: string;
    breakoutGroupAssigned: string;
}

export const localParticipantSliceInitialState: LocalParticipantState = {
    displayName: "",
    id: "",
    breakoutGroup: null,
    breakoutGroupAssigned: "",
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
    initialState: localParticipantSliceInitialState,
    reducers: {
        setDisplayName: (state, action: PayloadAction<{ displayName: string }>) => {
            return {
                ...state,
                displayName: action.payload.displayName,
            };
        },
        setBreakoutGroupAssigned: (state, action: PayloadAction<{ breakoutGroupAssigned: string }>) => {
            return {
                ...state,
                breakoutGroupAssigned: action.payload.breakoutGroupAssigned,
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
            if ("error" in action.payload) {
                if (action.payload.error === "room_locked") {
                    return {
                        ...state,
                        id: action.payload.selfId,
                    };
                }

                return state;
            }

            const { room, selfId, clientClaim } = action.payload || {};

            const client = room.clients.find((c) => c.id === selfId);

            return {
                ...state,
                id: selfId,
                roleName: client?.role?.roleName || "none",
                clientClaim,
                breakoutGroup: client?.breakoutGroup || null,
            };
        });
        builder.addCase(signalEvents.breakoutGroupJoined, (state, action) => {
            if (action.payload?.clientId !== state.id) {
                return state;
            }

            return {
                ...state,
                breakoutGroup: action.payload?.group,
            };
        });
    },
});

/**
 * Action creators
 */

export const { setDisplayName, setBreakoutGroupAssigned } = localParticipantSlice.actions;

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
 * Reactors
 */

startAppListening({
    actionCreator: toggleCameraEnabled,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enabled } = payload;
        const { isVideoEnabled } = selectLocalParticipantRaw(getState());
        const roomConnectionStatus = selectRoomConnectionStatus(getState());

        if (roomConnectionStatus !== "connected") {
            return;
        }
        dispatch(doEnableVideo({ enabled: enabled || !isVideoEnabled }));
    },
});

startAppListening({
    actionCreator: toggleMicrophoneEnabled,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enabled } = payload;
        const { isAudioEnabled } = selectLocalParticipantRaw(getState());
        const roomConnectionStatus = selectRoomConnectionStatus(getState());

        if (roomConnectionStatus !== "connected") {
            return;
        }
        dispatch(doEnableAudio({ enabled: enabled || !isAudioEnabled }));
    },
});

createReactor(
    [
        selectLocalParticipantDisplayName,
        selectLocalParticipantStickyReaction,
        selectRoomConnectionStatus,
        selectAppIsAssistant,
    ],
    ({ dispatch }, diplayName, stickyReaction, roomConnectionStatus, isAssistant) => {
        if (roomConnectionStatus === "connected" && !isAssistant) {
            dispatch(doSendClientMetadata());
        }
    },
);

createReactor(
    [selectBreakoutAssignments, selectDeviceId, selectLocalParticipantRaw],
    ({ dispatch }, breakoutAssignments, deviceId, localParticipant) => {
        const breakoutGroupAssigned = breakoutAssignments?.[deviceId || ""] || "";

        if (localParticipant.breakoutGroupAssigned === breakoutGroupAssigned) {
            return;
        }

        dispatch(setBreakoutGroupAssigned({ breakoutGroupAssigned }));
    },
);
