import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import type { LocalMediaOptions } from "./localMedia";
import { coreVersion } from "../../version";

/**
 * Reducer
 */

export interface AppConfig {
    isNodeSdk?: boolean;
    isDialIn?: boolean;
    displayName: string;
    localMediaOptions?: LocalMediaOptions;
    roomKey: string | null;
    roomUrl: string;
    userAgent?: string;
    externalId: string | null;
}

export interface AppState {
    isNodeSdk: boolean;
    isActive: boolean;
    isDialIn: boolean;
    roomUrl: string | null;
    roomName: string | null;
    displayName: string | null;
    userAgent: string | null;
    externalId: string | null;
    initialConfig?: AppConfig;
}

export const initialState: AppState = {
    isNodeSdk: false,
    isActive: false,
    isDialIn: false,
    roomName: null,
    roomUrl: null,
    displayName: null,
    userAgent: `core:${coreVersion}`,
    externalId: null,
};

export const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        doAppStart: (state, action: PayloadAction<AppConfig>) => {
            const url = new URL(action.payload.roomUrl);

            return {
                ...state,
                ...action.payload,
                roomName: url.pathname,
                initialConfig: { ...action.payload },
                isActive: true,
            };
        },
        doAppStop: (state) => {
            return { ...state, isActive: false };
        },
        doSetRoomUrl: (state, action: PayloadAction<string>) => {
            return { ...state, roomUrl: action.payload };
        },
    },
});

/**
 * Action creators
 */

export const { doAppStop, doAppStart, doSetRoomUrl } = appSlice.actions;

/**
 * Selectors
 */

export const selectAppRaw = (state: RootState) => state.app;
export const selectAppIsActive = (state: RootState) => state.app.isActive;
export const selectAppIsDialIn = (state: RootState) => state.app.isDialIn;
export const selectAppRoomName = (state: RootState) => state.app.roomName;
export const selectAppRoomUrl = (state: RootState) => state.app.roomUrl;
export const selectAppDisplayName = (state: RootState) => state.app.displayName;
export const selectAppUserAgent = (state: RootState) => state.app.userAgent;
export const selectAppExternalId = (state: RootState) => state.app.externalId;
export const selectAppIsNodeSdk = (state: RootState) => state.app.isNodeSdk;
export const selectAppInitialConfig = (state: RootState) => state.app.initialConfig;
