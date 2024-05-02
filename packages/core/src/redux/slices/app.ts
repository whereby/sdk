import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import type { LocalMediaOptions } from "./localMedia";
import { coreVersion } from "../../version";
import { startAppListening } from "../listenerMiddleware";

/**
 * Reducer
 */

interface AppConfig {
    isNodeSdk?: boolean;
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
    roomUrl: string | null;
    roomName: string | null;
    displayName: string | null;
    userAgent: string | null;
    externalId: string | null;
    initialConfig?: AppConfig;
    isLoaded: boolean;
}

const initialState: AppState = {
    isNodeSdk: false,
    isActive: false,
    roomName: null,
    roomUrl: null,
    displayName: null,
    userAgent: `core:${coreVersion}`,
    externalId: null,
    isLoaded: false,
};

export const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        doAppConfigure: (state, action: PayloadAction<AppConfig>) => {
            const url = new URL(action.payload.roomUrl);

            return {
                ...state,
                ...action.payload,
                roomName: url.pathname,
                initialConfig: { ...action.payload },
                isLoaded: true,
            };
        },
        doAppStart: (state) => {
            return { ...state, isActive: true };
        },
        doAppStop: (state) => {
            return { ...state, isActive: false };
        },
        doAppReset: (state) => {
            return { ...state, isLoaded: false };
        },
    },
});

/**
 * Action creators
 */

export const { doAppConfigure, doAppStop, doAppReset, doAppStart } = appSlice.actions;

/**
 * Selectors
 */

export const selectAppRaw = (state: RootState) => state.app;
export const selectAppIsActive = (state: RootState) => state.app.isActive;
export const selectAppRoomName = (state: RootState) => state.app.roomName;
export const selectAppRoomUrl = (state: RootState) => state.app.roomUrl;
export const selectAppDisplayName = (state: RootState) => state.app.displayName;
export const selectAppUserAgent = (state: RootState) => state.app.userAgent;
export const selectAppExternalId = (state: RootState) => state.app.externalId;
export const selectAppIsNodeSdk = (state: RootState) => state.app.isNodeSdk;
export const selectAppInitialConfig = (state: RootState) => state.app.initialConfig;
export const selectAppIsLoaded = (state: RootState) => state.app.isLoaded;

export const selectShouldReloadApp = createSelector(
    selectAppIsLoaded,
    selectAppInitialConfig,
    (appIsLoaded, appInitialConfig) => {
        return !appIsLoaded && appInitialConfig;
    },
);

/**
 * Reactors
 */

startAppListening({
    actionCreator: doAppReset,
    effect: (_, { dispatch, getState }) => {
        const state = getState();
        const appInitialConfig = selectAppInitialConfig(state);

        if (appInitialConfig) {
            dispatch(doAppConfigure(appInitialConfig));
        }
    },
});
