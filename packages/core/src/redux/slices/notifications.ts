import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { EventEmitter } from "events";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";
import { createReactor, startAppListening } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";
import { selectRemoteParticipants } from "./remoteParticipants";
import { selectSignalStatus } from "./signalConnection";
import { doEnableAudio, doEnableVideo, doSetLocalStickyReaction } from "./localParticipant";

export interface Notification {
    type: string;
    message: string;
    level?: "debug" | "log" | "info" | "warn" | "error";
    props?: {
        [key: string]: unknown;
    };
}

export interface NotificationEvent extends Notification {
    level: "debug" | "log" | "info" | "warn" | "error";
    timestamp: number;
}

export type NotificationLogLevel = "debug" | "log" | "info" | "warn" | "error";

export type NotificationsEventEmitter = EventEmitter<{ [logLevel in NotificationLogLevel]: [NotificationEvent] }>;

const emitter: NotificationsEventEmitter = new EventEmitter();

/**
 * Reducer
 */

export interface NotificationsState {
    emitter: NotificationsEventEmitter;
    events: Array<NotificationEvent>;
}

export const initialNotificationsState: NotificationsState = {
    emitter,
    events: [],
};

export const notificationsSlice = createSlice({
    name: "notifications",
    initialState: initialNotificationsState,
    reducers: {
        addNotification: (state, action: PayloadAction<NotificationEvent>) => {
            return {
                ...state,
                events: [...state.events, { ...action.payload }],
            };
        },
        doClearNotifications: (state) => {
            return {
                ...state,
                events: [],
            };
        },
    },
});

/**
 * Action creators
 */

export const { doClearNotifications } = notificationsSlice.actions;

export const doSetNotification = createAppThunk((payload: Notification) => (dispatch, getState) => {
    const notificationMessage: NotificationEvent = {
        ...payload,
        level: payload.level ?? "log",
        timestamp: Date.now(),
    };

    dispatch(notificationsSlice.actions.addNotification(notificationMessage));

    const state = getState();
    const emitter = selectNotificationsEmitter(state);

    emitter.emit(notificationMessage.level, notificationMessage);
});

/**
 * Selectors
 */

export const selectNotificationsRaw = (state: RootState) => state.notifications;
export const selectNotificationsEvents = (state: RootState) => state.notifications.events;
export const selectNotificationsEmitter = (state: RootState) => state.notifications.emitter;

/**
 * Reactors
 */

startAppListening({
    actionCreator: signalEvents.audioEnableRequested,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enable, requestedByClientId } = payload;

        const state = getState();
        const client = selectRemoteParticipants(state).find(({ id }) => id === requestedByClientId);

        if (!client) {
            console.warn("Could not find client that requested a local audio change");
            return;
        }

        dispatch(
            doSetNotification({
                type: enable ? "requestAudioEnable" : "requestAudioDisable",
                message: enable
                    ? `${client.displayName} has requested for you to speak`
                    : `${client.displayName} has requested for you to mute your microphone`,
                props: {
                    enable,
                    requestedByClientId,
                    requestedByClientDisplayName: client.displayName,
                },
            }),
        );
    },
});

startAppListening({
    actionCreator: signalEvents.clientMetadataReceived,
    effect: (action, { dispatch, getState }) => {
        const { clientId, stickyReaction } = action.payload.payload;

        const state = getState();
        const client = selectRemoteParticipants(state).find(({ id }) => id === clientId);

        if (!client) {
            return;
        }

        dispatch(
            doSetNotification({
                type: stickyReaction ? "remoteHandRaised" : "remoteHandLowered",
                message: `${client.displayName} ${stickyReaction ? "raised" : "lowered"} their hand`,
                props: {
                    clientId,
                    stickyReaction,
                },
            }),
        );
    },
});

createReactor([selectSignalStatus], ({ dispatch }, signalStatus) => {
    const notificationSignalStatuses = ["connected", "disconnected", "reconnecting"];

    if (notificationSignalStatuses.includes(signalStatus)) {
        dispatch(
            doSetNotification({
                type: "networkConnection",
                message: `Network ${signalStatus}`,
                level: signalStatus === "disconnected" ? "warn" : "info",
                props: {
                    status: signalStatus,
                },
            }),
        );
    }
});

startAppListening({
    actionCreator: doEnableAudio.fulfilled,
    effect: ({ payload }, { dispatch }) => {
        dispatch(
            doSetNotification({
                type: payload ? "localAudioEnabled" : "localAudioDisabled",
                message: `Local microphone ${payload ? "enabled" : "disabled"}`,
            }),
        );
    },
});

startAppListening({
    actionCreator: doEnableVideo.fulfilled,
    effect: ({ payload }, { dispatch }) => {
        dispatch(
            doSetNotification({
                type: payload ? "localVideoEnabled" : "localVideoDisabled",
                message: `Local video ${payload ? "enabled" : "disabled"}`,
            }),
        );
    },
});

startAppListening({
    actionCreator: doSetLocalStickyReaction.fulfilled,
    effect: ({ payload }, { dispatch }) => {
        dispatch(
            doSetNotification({
                type: payload ? "localHandRaised" : "localHandLowered",
                message: `You ${payload ? "raised" : "lowered"} your hand`,
                props: {
                    stickyReaction: payload,
                },
            }),
        );
    },
});
