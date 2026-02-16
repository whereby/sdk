import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import type { LocalMediaOptions } from "./localMedia";
import { coreVersion } from "../../version";

/**
 * Reducer
 */

export interface AppConfig {
    assistantKey?: string | null;
    displayName: string;
    externalId: string | null;
    ignoreBreakoutGroups?: boolean;
    isAudioRecorder?: boolean;
    isDialIn?: boolean;
    isNodeSdk?: boolean;
    localMediaOptions?: LocalMediaOptions;
    roomKey: string | null;
    roomUrl: string;
    userAgent?: string;
}

export interface AppState {
    displayName: string | null;
    externalId: string | null;
    ignoreBreakoutGroups: boolean;
    initialConfig?: AppConfig;
    isActive: boolean;
    isAssistant: boolean;
    isAudioRecorder: boolean;
    isDialIn: boolean;
    isNodeSdk: boolean;
    roomName: string | null;
    roomUrl: string | null;
    userAgent: string | null;
}

export const initialState: AppState = {
    displayName: null,
    externalId: null,
    ignoreBreakoutGroups: false,
    isActive: false,
    isAssistant: false,
    isAudioRecorder: false,
    isDialIn: false,
    isNodeSdk: false,
    roomName: null,
    roomUrl: null,
    userAgent: `core:${coreVersion}`,
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
                isAssistant: Boolean(action.payload.assistantKey),
            };
        },
        doAppStop: (state) => {
            return { ...state, isActive: false };
        },
    },
});

/**
 * Action creators
 */

export const { doAppStop, doAppStart } = appSlice.actions;

/**
 * Selectors
 */

export const selectAppRaw = (state: RootState) => state.app;
export const selectAppIsActive = (state: RootState) => state.app.isActive;
export const selectAppIsDialIn = (state: RootState) => state.app.isDialIn;
export const selectAppIsAudioRecorder = (state: RootState) => state.app.isAudioRecorder;
export const selectAppIsAssistant = (state: RootState) => state.app.isAssistant;
export const selectAppRoomName = (state: RootState) => state.app.roomName;
export const selectAppRoomUrl = (state: RootState) => state.app.roomUrl;
export const selectAppDisplayName = (state: RootState) => state.app.displayName;
export const selectAppUserAgent = (state: RootState) => state.app.userAgent;
export const selectAppExternalId = (state: RootState) => state.app.externalId;
export const selectAppIsNodeSdk = (state: RootState) => state.app.isNodeSdk;
export const selectAppInitialConfig = (state: RootState) => state.app.initialConfig;
export const selectAppIgnoreBreakoutGroups = (state: RootState) => state.app.ignoreBreakoutGroups;
