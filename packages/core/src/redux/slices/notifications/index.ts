import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { EventEmitter } from "events";
import { ChatMessage as SignalChatMessage } from "@whereby.com/media";
import { RootState } from "../../store";
import { createAppThunk } from "../../thunk";
import { createReactor, startAppListening } from "../../listenerMiddleware";
import { signalEvents } from "../signalConnection/actions";
import { selectRemoteParticipants } from "../remoteParticipants";
import { selectSignalStatus } from "../signalConnection";
import { selectIsAuthorizedToAskToSpeak } from "../authorization";

import {
    Notification,
    NotificationEvents,
    NotificationEvent,
    RequestAudioEvent,
    ChatMessageEvent,
    StickyReactionEvent,
} from "./events";
export * from "./events";

export type NotificationsEventEmitter = EventEmitter<NotificationEvents>;

const emitter: NotificationsEventEmitter = new EventEmitter();

function createNotification<T>(payload: Notification<T>): NotificationEvent<T> {
    const notificationEvent = {
        ...payload,
        timestamp: Date.now(),
    };
    return notificationEvent;
}

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

export const doSetNotification = createAppThunk((payload: NotificationEvent) => (dispatch, getState) => {
    dispatch(notificationsSlice.actions.addNotification(payload));

    const state = getState();
    const emitter = selectNotificationsEmitter(state);

    emitter.emit(payload.type as keyof NotificationEvents, payload);
    emitter.emit("*", payload); // also emit event to catch-all wildcard handlers
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

        dispatch(
            doSetNotification(
                createNotification<ChatMessageEvent>({
                    type: "chatMessageReceived",
                    message: `${client.displayName} says: ${payload.text}`,
                    props: {
                        client,
                        chatMessage: {
                            senderId: payload.senderId,
                            timestamp: payload.timestamp,
                            text: payload.text,
                        },
                    },
                }),
            ),
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
            doSetNotification(
                createNotification<RequestAudioEvent>({
                    type: enable ? "requestAudioEnable" : "requestAudioDisable",
                    message: enable
                        ? `${client.displayName} has requested for you to speak`
                        : `${client.displayName} has muted your microphone`,
                    props: {
                        client,
                        enable,
                    },
                }),
            ),
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
            doSetNotification(
                createNotification<StickyReactionEvent>({
                    type: stickyReaction ? "remoteHandRaised" : "remoteHandLowered",
                    message: `${client.displayName} ${stickyReaction ? "raised" : "lowered"} their hand`,
                    props: {
                        client,
                        stickyReaction,
                    },
                }),
            ),
        );
    },
});

createReactor([selectSignalStatus], ({ dispatch }, signalStatus) => {
    if (signalStatus === "disconnected") {
        dispatch(
            doSetNotification(
                createNotification<void>({
                    type: "signalTrouble",
                    message: `Network connection lost. Trying to reconnect you...`,
                }),
            ),
        );
    } else {
        dispatch(
            doSetNotification(
                createNotification<void>({
                    type: "signalOk",
                    message: `Network connection available`,
                }),
            ),
        );
    }
});
