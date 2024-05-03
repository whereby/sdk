import { PayloadAction, createSlice } from "@reduxjs/toolkit";
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

export type NotificationCallbackFunction = (message: NotificationMessage) => void;

/**
 * Reducer
 */

export interface NotificationsState {
    messages: NotificationMessage[];
    callback: NotificationCallbackFunction;
}

export const initialNotificationsState: NotificationsState = {
    messages: [],
    callback: () => {},
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
        doSetNotificationCallback: (state, action: PayloadAction<NotificationCallbackFunction>) => {
            return {
                ...state,
                callback: action.payload,
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

export const { doClearNotifications, doSetNotificationCallback } = notificationsSlice.actions;

export const doSetNotification = createAppThunk((payload: NotificationEvent) => (dispatch, getState) => {
    const notificationMessage: NotificationMessage = {
        ...payload,
        level: payload.level ?? "log",
        timestamp: Date.now(),
    };

    dispatch(notificationsSlice.actions.addNotification(notificationMessage));

    const state = getState();
    const callback = selectNotificationsCallback(state);

    if (callback) {
        callback.call(undefined, notificationMessage);
    }
});

/**
 * Selectors
 */

export const selectNotificationsRaw = (state: RootState) => state.notifications;
export const selectNotificationsMessages = (state: RootState) => state.notifications.messages;
export const selectNotificationsCallback = (state: RootState) => state.notifications.callback;
