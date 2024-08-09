import { createSlice, ThunkDispatch, PayloadAction, createSelector, UnknownAction } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { createAppThunk } from "../../thunk";
import { createReactor, startAppListening } from "../../listenerMiddleware";
import { selectDeviceCredentialsRaw } from "../deviceCredentials";

import {
    AudioEnableRequestedEvent,
    AudioEnabledEvent,
    ChatMessage,
    ClientKickedEvent,
    ClientLeftEvent,
    ClientMetadataReceivedEvent,
    ClientUnableToJoinEvent,
    CloudRecordingStartedEvent,
    KnockAcceptedEvent,
    KnockRejectedEvent,
    KnockerLeftEvent,
    LiveTranscriptionStartedEvent,
    LiveTranscriptionStoppedEvent,
    NewClientEvent,
    RoomJoinedEvent,
    RoomKnockedEvent,
    RoomLockedEvent,
    RoomSessionEndedEvent,
    ScreenshareStartedEvent,
    ScreenshareStoppedEvent,
    ServerSocket,
    SpotlightAddedEvent,
    SpotlightRemovedEvent,
    VideoEnabledEvent,
} from "@whereby.com/media";
import { Credentials } from "../../../api";
import { selectAppIsActive } from "../app";
import { signalEvents } from "./actions";
export { signalEvents } from "./actions";

function forwardSocketEvents(socket: ServerSocket, dispatch: ThunkDispatch<RootState, unknown, UnknownAction>) {
    socket.on("room_joined", (payload: RoomJoinedEvent) => dispatch(signalEvents.roomJoined(payload)));
    socket.on("new_client", (payload: NewClientEvent) => dispatch(signalEvents.newClient(payload)));
    socket.on("client_left", (payload: ClientLeftEvent) => dispatch(signalEvents.clientLeft(payload)));
    socket.on("client_kicked", (payload: ClientKickedEvent) => dispatch(signalEvents.clientKicked(payload)));
    socket.on("client_unable_to_join", (payload: ClientUnableToJoinEvent) =>
        dispatch(signalEvents.clientUnableToJoin(payload)),
    );
    socket.on("audio_enabled", (payload: AudioEnabledEvent) => dispatch(signalEvents.audioEnabled(payload)));
    socket.on("video_enabled", (payload: VideoEnabledEvent) => dispatch(signalEvents.videoEnabled(payload)));
    socket.on("audio_enable_requested", (payload: AudioEnableRequestedEvent) =>
        dispatch(signalEvents.audioEnableRequested(payload)),
    );
    socket.on("client_metadata_received", (payload: ClientMetadataReceivedEvent) =>
        dispatch(signalEvents.clientMetadataReceived(payload)),
    );
    socket.on("chat_message", (payload: ChatMessage) => dispatch(signalEvents.chatMessage(payload)));
    socket.on("disconnect", () => dispatch(signalEvents.disconnect()));
    socket.on("room_knocked", (payload: RoomKnockedEvent) => dispatch(signalEvents.roomKnocked(payload)));
    socket.on("room_left", () => dispatch(signalEvents.roomLeft()));
    socket.on("room_locked", (payload: RoomLockedEvent) => dispatch(signalEvents.roomLocked(payload)));
    socket.on("room_session_ended", (payload: RoomSessionEndedEvent) =>
        dispatch(signalEvents.roomSessionEnded(payload)),
    );
    socket.on("knocker_left", (payload: KnockerLeftEvent) => dispatch(signalEvents.knockerLeft(payload)));
    socket.on("knock_handled", (payload: KnockAcceptedEvent | KnockRejectedEvent) =>
        dispatch(signalEvents.knockHandled(payload)),
    );
    socket.on("screenshare_started", (payload: ScreenshareStartedEvent) =>
        dispatch(signalEvents.screenshareStarted(payload)),
    );
    socket.on("screenshare_stopped", (payload: ScreenshareStoppedEvent) =>
        dispatch(signalEvents.screenshareStopped(payload)),
    );
    socket.on("cloud_recording_started", (payload: CloudRecordingStartedEvent) =>
        dispatch(signalEvents.cloudRecordingStarted(payload)),
    );
    socket.on("cloud_recording_stopped", () => dispatch(signalEvents.cloudRecordingStopped()));
    socket.on("streaming_stopped", () => dispatch(signalEvents.streamingStopped()));
    socket.on("spotlight_added", (payload: SpotlightAddedEvent) => dispatch(signalEvents.spotlightAdded(payload)));
    socket.on("spotlight_removed", (payload: SpotlightRemovedEvent) =>
        dispatch(signalEvents.spotlightRemoved(payload)),
    );
    socket.on("live_transcription_started", (payload: LiveTranscriptionStartedEvent) =>
        dispatch(signalEvents.liveTranscriptionStarted(payload)),
    );
    socket.on("live_transcription_stopped", (payload: LiveTranscriptionStoppedEvent) =>
        dispatch(signalEvents.liveTranscriptionStopped(payload)),
    );
}

const SIGNAL_BASE_URL = process.env.REACT_APP_SIGNAL_BASE_URL || "wss://signal.appearin.net";

function createSocket() {
    const parsedUrl = new URL(SIGNAL_BASE_URL);
    const socketHost = parsedUrl.origin;

    const socketOverrides = {
        autoConnect: false,
    };

    return new ServerSocket(socketHost, socketOverrides);
}

/**
 * Reducer
 */
export interface SignalConnectionState {
    deviceIdentified: boolean;
    isIdentifyingDevice: boolean;
    status: "ready" | "connecting" | "connected" | "disconnected" | "reconnecting"; // the state of the underlying socket.io connection
    socket: ServerSocket | null;
}

const initialState: SignalConnectionState = {
    deviceIdentified: false,
    isIdentifyingDevice: false,
    status: "ready",
    socket: null,
};

export const signalConnectionSlice = createSlice({
    name: "signalConnection",
    initialState,
    reducers: {
        socketConnecting: (state) => {
            return {
                ...state,
                status: "connecting",
            };
        },
        socketConnected: (state, action: PayloadAction<ServerSocket>) => {
            return {
                ...state,
                socket: action.payload,
                status: "connected",
            };
        },
        socketDisconnected: (state) => {
            return {
                ...state,
                deviceIdentified: false,
                status: "disconnected",
            };
        },
        socketReconnecting: (state) => {
            return {
                ...state,
                status: "reconnecting",
            };
        },
        deviceIdentifying: (state) => {
            return {
                ...state,
                isIdentifyingDevice: true,
            };
        },
        deviceIdentified: (state) => {
            return {
                ...state,
                deviceIdentified: true,
                isIdentifyingDevice: false,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.disconnect, (state) => {
            return {
                ...state,
                deviceIdentified: false,
                status: "disconnected",
            };
        });
    },
});

export const {
    deviceIdentifying,
    deviceIdentified,
    socketConnected,
    socketConnecting,
    socketDisconnected,
    socketReconnecting,
} = signalConnectionSlice.actions;

/**
 * Action creators
 */
export const doSignalConnect = createAppThunk(() => {
    return (dispatch, getState) => {
        if (selectSignalConnectionSocket(getState())) {
            return;
        }

        dispatch(socketConnecting());

        const socket = createSocket();

        socket.on("connect", () => dispatch(socketConnected(socket)));
        socket.on("device_identified", () => dispatch(deviceIdentified()));
        socket.getManager().on("reconnect", () => dispatch(socketReconnecting()));
        forwardSocketEvents(socket, dispatch);

        socket.connect();
    };
});

export const doSignalIdentifyDevice = createAppThunk(
    ({ deviceCredentials }: { deviceCredentials: Credentials }) =>
        (dispatch, getState) => {
            const state = getState();
            const signalSocket = selectSignalConnectionSocket(state);
            const deviceIdentified = selectSignalConnectionDeviceIdentified(state);

            if (!signalSocket) {
                return;
            }

            if (deviceIdentified) {
                return;
            }

            signalSocket.emit("identify_device", { deviceCredentials });
            dispatch(deviceIdentifying());
        },
);

export const doSignalDisconnect = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const signalStatus = selectSignalStatus(state);

    if (signalStatus === "connected") {
        const socket = selectSignalConnectionRaw(state).socket;

        socket?.disconnect();
        dispatch(socketDisconnected());
    }
});

/**
 * Selectors
 */
export const selectSignalConnectionRaw = (state: RootState) => state.signalConnection;
export const selectSignalIsIdentifyingDevice = (state: RootState) => state.signalConnection.isIdentifyingDevice;
export const selectSignalConnectionDeviceIdentified = (state: RootState) => state.signalConnection.deviceIdentified;
export const selectSignalStatus = (state: RootState) => state.signalConnection.status;
export const selectSignalConnectionSocket = (state: RootState) => state.signalConnection.socket;

/**
 * Reactors
 */

export const selectShouldConnectSignal = createSelector(
    selectAppIsActive,
    selectSignalStatus,
    (appIsActive, signalStatus) => {
        if (appIsActive && ["ready", "reconnecting"].includes(signalStatus)) {
            return true;
        }
        return false;
    },
);

createReactor([selectShouldConnectSignal], ({ dispatch }, shouldConnectSignal) => {
    if (shouldConnectSignal) {
        dispatch(doSignalConnect());
    }
});

export const selectShouldIdentifyDevice = createSelector(
    selectDeviceCredentialsRaw,
    selectSignalStatus,
    selectSignalConnectionDeviceIdentified,
    selectSignalIsIdentifyingDevice,
    (deviceCredentialsRaw, signalStatus, deviceIdentified, isIdentifyingDevice) => {
        if (deviceCredentialsRaw.data && signalStatus === "connected" && !deviceIdentified && !isIdentifyingDevice) {
            return true;
        }
        return false;
    },
);

createReactor(
    [selectShouldIdentifyDevice, selectDeviceCredentialsRaw],
    ({ dispatch }, shouldIdentifyDevice, deviceCredentialsRaw) => {
        if (shouldIdentifyDevice && deviceCredentialsRaw.data) {
            dispatch(doSignalIdentifyDevice({ deviceCredentials: deviceCredentialsRaw.data }));
        }
    },
);

startAppListening({
    actionCreator: signalEvents.roomLeft,
    effect: (_, { dispatch }) => {
        dispatch(doSignalDisconnect());
    },
});

startAppListening({
    actionCreator: signalEvents.clientKicked,
    effect: (_, { dispatch }) => {
        dispatch(doSignalDisconnect());
    },
});
