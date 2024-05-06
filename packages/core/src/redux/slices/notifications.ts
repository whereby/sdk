import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { EventEmitter } from "events";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";

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
