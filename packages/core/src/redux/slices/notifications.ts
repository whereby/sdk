import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { EventEmitter } from "events";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";
import { createReactor, startAppListening } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";
import { selectRemoteParticipants } from "./remoteParticipants";
import { selectSignalStatus } from "./signalConnection";
import { doEnableAudio, doEnableVideo, doSetLocalStickyReaction } from "./localParticipant";
import { ChatMessage as SignalChatMessage } from "@whereby.com/media";
import { ChatMessage } from "./chat";
import { selectIsAuthorizedToAskToSpeak } from "./authorization";

export interface Notification {
    type: string;
    message: string;
    props?: {
        [key: string]: unknown;
    };
}

export interface NotificationEvent extends Notification {
    timestamp: number;
}

export type NotificationsEventEmitter = EventEmitter<{
    "*": [NotificationEvent];
    [type: string]: [NotificationEvent];
}>;

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
        timestamp: Date.now(),
    };

    dispatch(notificationsSlice.actions.addNotification(notificationMessage));

    const state = getState();
    const emitter = selectNotificationsEmitter(state);

    emitter.emit(notificationMessage.type, notificationMessage);
    emitter.emit("*", notificationMessage); // also emit event to catch-all wildcard handlers
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
    actionCreator: signalEvents.chatMessage,
    effect: ({ payload }: PayloadAction<SignalChatMessage>, { dispatch, getState }) => {
        const state = getState();
        const client = selectRemoteParticipants(state).find(({ id }) => id === payload.senderId);

        if (!client) {
            console.warn("Could not find remote client that sent chat message");
            return;
        }

        const chatMessage: ChatMessage = {
            senderId: payload.senderId,
            timestamp: payload.timestamp,
            text: payload.text,
        };

        dispatch(
            doSetNotification({
                type: "chatMessageReceived",
                message: `${client.displayName} says: ${chatMessage.text}`,
                props: {
                    client,
                    chatMessage,
                },
            }),
        );
    },
});

startAppListening({
    actionCreator: signalEvents.audioEnableRequested,
    effect: ({ payload }, { dispatch, getState }) => {
        const { enable, requestedByClientId } = payload;

        const state = getState();
        const client = selectRemoteParticipants(state).find(({ id }) => id === requestedByClientId);

        if (!client) {
            console.warn("Could not find remote client that requested a local audio change");
            return;
        }

        dispatch(
            doSetNotification({
                type: enable ? "requestAudioEnable" : "requestAudioDisable",
                message: enable
                    ? `${client.displayName} has requested for you to speak`
                    : `${client.displayName} has muted your microphone`,
                props: {
                    client,
                    enable,
                },
            }),
        );
    },
});

startAppListening({
    actionCreator: signalEvents.clientMetadataReceived,
    effect: (action, { dispatch, getOriginalState, getState }) => {
        const { error, payload } = action.payload;

        if (error || !payload) {
            return;
        }

        const { clientId, stickyReaction } = payload;

        const state = getState();

        const canAskToSpeak = selectIsAuthorizedToAskToSpeak(state);
        if (!canAskToSpeak) {
            return;
        }

        const client = selectRemoteParticipants(state).find(({ id }) => id === clientId);
        if (!client) {
            console.warn("Could not find remote client that provided updated metadata");
            return;
        }

        const previousState = getOriginalState();
        const previousClient = selectRemoteParticipants(previousState).find(({ id }) => id === clientId);
        if (
            (!stickyReaction && !previousClient?.stickyReaction) ||
            stickyReaction?.timestamp === previousClient?.stickyReaction?.timestamp
        ) {
            return; // No changes seen in stickyReaction state
        }

        dispatch(
            doSetNotification({
                type: stickyReaction ? "remoteHandRaised" : "remoteHandLowered",
                message: `${client.displayName} ${stickyReaction ? "raised" : "lowered"} their hand`,
                props: {
                    client,
                    stickyReaction,
                },
            }),
        );
    },
});

createReactor([selectSignalStatus], ({ dispatch }, signalStatus) => {
    if (signalStatus === "disconnected") {
        dispatch(
            doSetNotification({
                type: "signalTrouble",
                message: `Network connection lost. Trying to reconnect you...`,
            }),
        );
    } else {
        dispatch(
            doSetNotification({
                type: "signalOk",
                message: `Network connection available`,
            }),
        );
    }
});
