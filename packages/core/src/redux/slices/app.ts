import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import type { LocalMediaOptions } from "./localMedia";
import { coreVersion } from "../../version";

/**
 * Reducer
 */
export interface AppState {
    isNodeSdk: boolean;
    wantsToJoin: boolean;
    roomUrl: string | null;
    roomName: string | null;
    roomKey: string | null;
    displayName: string | null;
    userAgent: string | null;
    externalId: string | null;
}

const initialState: AppState = {
    isNodeSdk: false,
    wantsToJoin: false,
    roomName: null,
    roomKey: null,
    roomUrl: null,
    displayName: null,
    userAgent: `core:${coreVersion}`,
    externalId: null,
};

export const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        doAppJoin: (
            state,
            action: PayloadAction<{
                isNodeSdk?: boolean;
                displayName: string;
                localMediaOptions?: LocalMediaOptions;
                roomKey: string | null;
                roomUrl: string;
                userAgent?: string;
                externalId: string | null;
            }>,
        ) => {
            const url = new URL(action.payload.roomUrl);

            return {
                ...state,
                ...action.payload,
                roomName: url.pathname,
                wantsToJoin: true,
            };
        },
        appLeft: (state) => {
            return { ...state, wantsToJoin: false };
        },
        setRoomKey: (state, action: PayloadAction<string>) => {
            return {
                ...state,
                roomKey: action.payload,
            };
        },
    },
});

/**
 * Action creators
 */
export const { doAppJoin, appLeft, setRoomKey } = appSlice.actions;

/**
 * Selectors
 */
export const selectAppRaw = (state: RootState) => state.app;
export const selectAppWantsToJoin = (state: RootState) => state.app.wantsToJoin;
export const selectAppRoomName = (state: RootState) => state.app.roomName;
export const selectAppRoomUrl = (state: RootState) => state.app.roomUrl;
export const selectAppRoomKey = (state: RootState) => state.app.roomKey;
export const selectAppDisplayName = (state: RootState) => state.app.displayName;
export const selectAppUserAgent = (state: RootState) => state.app.userAgent;
export const selectAppExternalId = (state: RootState) => state.app.externalId;
export const selectAppIsNodeSdk = (state: RootState) => state.app.isNodeSdk;
