import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";

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
}

export const initialNotificationsState: NotificationsState = {
    messages: [],
};

export const notificationsSlice = createSlice({
    name: "notifications",
    initialState: initialNotificationsState,
    reducers: {
        doSetNotification: (state, action: PayloadAction<NotificationEvent>) => {
            const notificationMessage: NotificationMessage = {
                ...action.payload,
                level: action.payload.level ?? "log",
                timestamp: Date.now(),
            };

            return {
                ...state,
                messages: [...state.messages, notificationMessage],
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

export const { doSetNotification, doClearNotifications } = notificationsSlice.actions;

/**
 * Selectors
 */

export const selectNotificationsRaw = (state: RootState) => state.notifications;
export const selectNotificationsMessages = (state: RootState) => state.notifications.messages;
