import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { EventEmitter } from "events";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";

export interface NotificationEvent {
    type: string;
    message: string;
    level?: "debug" | "log" | "info" | "warn" | "error";
    props?: {
        [key: string]: unknown;
    };
}

export interface NotificationMessage extends NotificationEvent {
    level: "debug" | "log" | "info" | "warn" | "error";
    timestamp: number;
}

/**
 * Reducer
 */

export interface NotificationsState {
    messages: NotificationMessage[];
    emitter: EventEmitter;
}

export const initialNotificationsState: NotificationsState = {
    messages: [],
    emitter: new EventEmitter(),
};

export const notificationsSlice = createSlice({
    name: "notifications",
    initialState: initialNotificationsState,
    reducers: {
        addNotification: (state, action: PayloadAction<NotificationMessage>) => {
            return {
                ...state,
                messages: [...state.messages, { ...action.payload }],
            };
        },
        doClearNotifications: (state) => {
            return {
                ...state,
                messages: [],
            };
        },
    },
});

/**
 * Action creators
 */

export const { doClearNotifications } = notificationsSlice.actions;

export const doSetNotification = createAppThunk((payload: NotificationEvent) => (dispatch, getState) => {
    const notificationMessage: NotificationMessage = {
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
export const selectNotificationsMessages = (state: RootState) => state.notifications.messages;
export const selectNotificationsEmitter = (state: RootState) => state.notifications.emitter;
