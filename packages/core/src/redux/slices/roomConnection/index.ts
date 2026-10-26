import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { KnockResponse } from "@whereby.com/media";

import { createReactor, startAppListening } from "../../listenerMiddleware";
import { selectRoomConnectionError, selectRoomConnectionIsRejoining, selectRoomConnectionStatus } from "./selectors";
import { createAppThunk } from "../../thunk";
import {
    doAppStop,
    selectAppDisplayName,
    selectAppRoomName,
    selectAppUserAgent,
    selectAppExternalId,
    selectAppIsActive,
    selectAppIsAudioRecorder,
    selectAppIsDialIn,
} from "../app";
import { selectAssistantKey, selectRoomKey, setRoomKey } from "../authorization";

import { doOrganizationFetch, selectOrganizationId } from "../organization";
import { signalEvents } from "../signalConnection/actions";
import {
    doSignalDisconnect,
    selectSignalConnectionDeviceIdentified,
    selectSignalConnectionRaw,
} from "../signalConnection";
import { selectIsCameraEnabled, selectIsMicrophoneEnabled, selectLocalMediaStatus } from "../localMedia";
import { selectSelfId, selectLocalParticipantClientClaim } from "../localParticipant/selectors";

export type ConnectionStatus =
    | "ready"
    | "connecting"
    | "connected"
    | "room_locked"
    | "knocking"
    | "knock_on_hold"
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
    knockResponse: KnockResponse | null;
    isRejoining: boolean;
}

export const roomConnectionSliceInitialState: RoomConnectionState = {
    session: null,
    status: "ready",
    error: null,
    knockResponse: null,
    isRejoining: false,
};

export interface RoomRejoinedPayload {
    selfId: string;
    previousSelfId: string;
}

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
        knockResponseReceived: (state, action: PayloadAction<KnockResponse | null>) => {
            return {
                ...state,
                knockResponse: action.payload,
            };
        },
        // Dispatched when the room has been joined again after the signal connection dropped. signalEvents.roomJoined
        // has already updated the state.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        roomRejoined: (state, action: PayloadAction<RoomRejoinedPayload>) => {
            return state;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if ("error" in action.payload) {
                if (action.payload.error === "room_locked" && action.payload.isLocked) {
                    return {
                        ...state,
                        status: "room_locked",
                    };
                }

                return {
                    ...state,
                    status: "disconnected",
                    error: action.payload.error,
                    isRejoining: false,
                };
            }

            const { room } = action.payload;

            return {
                ...state,
                status: "connected",
                session: room.session ?? null,
                isRejoining: false,
            };
        });
        builder.addCase(signalEvents.disconnect, (state, action) => {
            if (["kicked", "left"].includes(state.status)) {
                return { ...state };
            }

            const { willReconnect } = action.payload;

            return {
                ...state,
                status: willReconnect ? "reconnecting" : "disconnected",
                // Only a dropped connection that will reconnect rejoins the room.
                isRejoining: willReconnect && (state.isRejoining || state.status === "connected"),
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
        builder.addCase(doOrganizationFetch.rejected, (state) => {
            return {
                ...state,
                status: "disconnected",
                error: "organization_fetch_failed",
            };
        });
    },
});

/**
 * Action creators
 */

const { connectionStatusChanged, knockResponseReceived } = roomConnectionSlice.actions;

export const { roomRejoined } = roomConnectionSlice.actions;

export const doKnockRoom = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const roomName = selectAppRoomName(state);
    const roomKey = selectRoomKey(state);
    const displayName = selectAppDisplayName(state);
    const isDialIn = selectAppIsDialIn(state);
    const isAudioRecorder = selectAppIsAudioRecorder(state);
    const userAgent = selectAppUserAgent(state);
    const externalId = selectAppExternalId(state);
    const organizationId = selectOrganizationId(state);
    const connectionStatus = selectRoomConnectionStatus(state);
    const clientClaim = selectLocalParticipantClientClaim(state);

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
        isAudioRecorder,
        isDevicePermissionDenied: false,
        kickFromOtherRooms: false,
        organizationId,
        roomKey,
        roomName,
        userAgent,
        externalId,
        ...(clientClaim && { clientClaim }),
    });

    dispatch(connectionStatusChanged("knocking"));
});

export const doCancelKnock = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const connectionStatus = selectRoomConnectionStatus(state);

    if (connectionStatus !== "knocking") {
        console.warn("Not knocking, cancel knock aborted");
        return;
    }

    socket?.emit("cancel_room_knock");
    dispatch(connectionStatusChanged("ready"));
});

export const doConnectRoom = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const roomName = selectAppRoomName(state);
    const roomKey = selectRoomKey(state);
    const assistantKey = selectAssistantKey(state);
    const displayName = selectAppDisplayName(state);
    const userAgent = selectAppUserAgent(state);
    const externalId = selectAppExternalId(state);
    const isDialIn = selectAppIsDialIn(state);
    const isAudioRecorder = selectAppIsAudioRecorder(state);
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
        isAudioRecorder,
        isDevicePermissionDenied: false,
        kickFromOtherRooms: false,
        organizationId,
        roomKey,
        assistantKey,
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
    actionCreator: signalEvents.roomJoined,
    effect: ({ payload }, { dispatch, getOriginalState }) => {
        if ("error" in payload) {
            return;
        }

        const originalState = getOriginalState();

        if (!selectRoomConnectionIsRejoining(originalState)) {
            return;
        }

        dispatch(roomRejoined({ selfId: payload.selfId, previousSelfId: selectSelfId(originalState) }));
    },
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
        } else if (resolution === "on_hold") {
            dispatch(knockResponseReceived(payload.knockResponse ?? null));
            dispatch(connectionStatusChanged("knock_on_hold"));
        } else if (resolution === "rejected") {
            dispatch(knockResponseReceived(payload.knockResponse ?? null));
            dispatch(connectionStatusChanged("knock_rejected"));
        }
    },
});

startAppListening({
    actionCreator: signalEvents.clientKicked,
    effect: (_, { dispatch }) => {
        dispatch(doAppStop());
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
            dispatch(doSignalDisconnect());
        }
    },
});
