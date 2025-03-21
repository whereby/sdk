import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";

import { createReactor, startAppListening } from "../../listenerMiddleware";
import { selectRoomConnectionError, selectRoomConnectionStatus } from "./selectors";
import { createAppThunk } from "../../thunk";
import {
    doAppStop,
    selectAppDisplayName,
    selectAppRoomName,
    selectAppUserAgent,
    selectAppExternalId,
    selectAppIsActive,
    selectAppIsDialIn,
} from "../app";
import { selectRoomKey, setRoomKey } from "../authorization";

import { selectOrganizationId } from "../organization";
import { signalEvents } from "../signalConnection/actions";
import {
    doSignalDisconnect,
    selectSignalConnectionDeviceIdentified,
    selectSignalConnectionRaw,
    socketReconnecting,
} from "../signalConnection";
import { selectIsCameraEnabled, selectIsMicrophoneEnabled, selectLocalMediaStatus } from "../localMedia";
import { selectSelfId, selectLocalParticipantClientClaim } from "../localParticipant/selectors";

export type ConnectionStatus =
    | "ready"
    | "connecting"
    | "connected"
    | "room_locked"
    | "knocking"
    | "knock_rejected"
    | "kicked"
    | "leaving"
    | "left"
    | "disconnected"
    | "reconnecting";

/**
 * Reducer
 */

export interface RoomConnectionState {
    session: { createdAt: string; id: string } | null;
    status: ConnectionStatus;
    error: string | null;
}

export const roomConnectionSliceInitialState: RoomConnectionState = {
    session: null,
    status: "ready",
    error: null,
};

export const roomConnectionSlice = createSlice({
    name: "roomConnection",
    initialState: roomConnectionSliceInitialState,
    reducers: {
        connectionStatusChanged: (state, action: PayloadAction<ConnectionStatus>) => {
            return {
                ...state,
                status: action.payload,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const { error, isLocked, room } = action.payload || {};

            if (error === "room_locked" && isLocked) {
                return {
                    ...state,
                    status: "room_locked",
                };
            }

            if (error) {
                return {
                    ...state,
                    status: "disconnected",
                    error,
                };
            }

            return {
                ...state,
                status: "connected",
                session: room?.session ?? null,
            };
        });
        builder.addCase(signalEvents.disconnect, (state) => {
            if (["kicked", "left"].includes(state.status)) {
                return { ...state };
            }

            return {
                ...state,
                status: "disconnected",
            };
        });
        builder.addCase(signalEvents.newClient, (state, action) => {
            return {
                ...state,
                session: action.payload.room?.session ?? null,
            };
        });
        builder.addCase(signalEvents.roomSessionEnded, (state, action) => {
            if (state.session?.id !== action.payload.roomSessionId) {
                return state;
            }

            return {
                ...state,
                session: null,
            };
        });
        builder.addCase(signalEvents.clientKicked, (state) => {
            return {
                ...state,
                status: "kicked",
            };
        });
        builder.addCase(signalEvents.roomLeft, (state) => {
            return {
                ...state,
                status: "left",
            };
        });
        builder.addCase(socketReconnecting, (state) => {
            return {
                ...state,
                status: "reconnecting",
            };
        });
    },
});

/**
 * Action creators
 */

const { connectionStatusChanged } = roomConnectionSlice.actions;

export const doKnockRoom = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const roomName = selectAppRoomName(state);
    const roomKey = selectRoomKey(state);
    const displayName = selectAppDisplayName(state);
    const isDialIn = selectAppIsDialIn(state);
    const userAgent = selectAppUserAgent(state);
    const externalId = selectAppExternalId(state);
    const organizationId = selectOrganizationId(state);
    const connectionStatus = selectRoomConnectionStatus(state);

    if (connectionStatus !== "room_locked") {
        console.warn("Room is not locked, knock aborted");
        return;
    }

    socket?.emit("knock_room", {
        avatarUrl: null,
        config: {
            isAudioEnabled: true,
            isVideoEnabled: true,
        },
        deviceCapabilities: { canScreenshare: true },
        displayName,
        isCoLocated: false,
        isDialIn,
        isDevicePermissionDenied: false,
        kickFromOtherRooms: false,
        organizationId,
        roomKey,
        roomName,
        userAgent,
        externalId,
    });

    dispatch(connectionStatusChanged("knocking"));
});

export const doConnectRoom = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const roomName = selectAppRoomName(state);
    const roomKey = selectRoomKey(state);
    const displayName = selectAppDisplayName(state);
    const userAgent = selectAppUserAgent(state);
    const externalId = selectAppExternalId(state);
    const isDialIn = selectAppIsDialIn(state);
    const organizationId = selectOrganizationId(state);
    const isCameraEnabled = selectIsCameraEnabled(getState());
    const isMicrophoneEnabled = selectIsMicrophoneEnabled(getState());
    const clientClaim = selectLocalParticipantClientClaim(getState());

    socket?.emit("join_room", {
        avatarUrl: null,
        config: {
            isAudioEnabled: isMicrophoneEnabled,
            isVideoEnabled: isCameraEnabled,
        },
        deviceCapabilities: { canScreenshare: true },
        displayName,
        isCoLocated: false,
        isDialIn,
        isDevicePermissionDenied: false,
        kickFromOtherRooms: false,
        organizationId,
        roomKey,
        roomName,
        userAgent,
        externalId,
        ...(clientClaim && { clientClaim }),
    });

    dispatch(connectionStatusChanged("connecting"));
});

/**
 * Reactors
 */

export const selectShouldConnectRoom = createSelector(
    [
        selectAppIsActive,
        selectOrganizationId,
        selectRoomConnectionStatus,
        selectSignalConnectionDeviceIdentified,
        selectLocalMediaStatus,
        selectRoomConnectionError,
    ],
    (
        appIsActive,
        hasOrganizationIdFetched,
        roomConnectionStatus,
        signalConnectionDeviceIdentified,
        localMediaStatus,
        roomConnectionError,
    ) => {
        if (
            appIsActive &&
            localMediaStatus === "started" &&
            signalConnectionDeviceIdentified &&
            !!hasOrganizationIdFetched &&
            ["ready", "reconnecting", "disconnected"].includes(roomConnectionStatus) &&
            !roomConnectionError
        ) {
            return true;
        }
        return false;
    },
);

createReactor([selectShouldConnectRoom], ({ dispatch }, shouldConnectRoom) => {
    if (shouldConnectRoom) {
        dispatch(doConnectRoom());
    }
});

startAppListening({
    actionCreator: signalEvents.knockHandled,
    effect: ({ payload }, { dispatch, getState }) => {
        const { clientId, resolution } = payload;

        const state = getState();
        const selfId = selectSelfId(state);

        if (clientId !== selfId) {
            return;
        }

        if (resolution === "accepted") {
            dispatch(setRoomKey(payload.metadata.roomKey));
            dispatch(doConnectRoom());
        } else if (resolution === "rejected") {
            dispatch(connectionStatusChanged("knock_rejected"));
        }
    },
});

startAppListening({
    actionCreator: doAppStop,
    effect: (_, { dispatch, getState }) => {
        const state = getState();

        const roomConnectionStatus = selectRoomConnectionStatus(state);

        if (roomConnectionStatus === "connected") {
            const socket = selectSignalConnectionRaw(state).socket;

            socket?.emit("leave_room");

            dispatch(connectionStatusChanged("leaving"));
        } else {
            doSignalDisconnect();
        }
    },
});
