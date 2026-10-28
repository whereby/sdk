import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppAsyncThunk } from "../thunk";
import { createReactor } from "../listenerMiddleware";
import { selectAppIsActive } from "./app";
import { Credentials } from "../../api";

/**
 * Reducer
 */

export interface DeviceCredentialsState {
    isFetching: boolean;
    data?: Credentials | null;
    error?: unknown;
}

export const deviceCredentialsSliceInitialState: DeviceCredentialsState = {
    isFetching: false,
    data: null,
    error: null,
};

export const deviceCredentialsSlice = createSlice({
    name: "deviceCredentials",
    initialState: deviceCredentialsSliceInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(doGetDeviceCredentials.pending, (state) => {
            return {
                ...state,
                isFetching: true,
            };
        });
        builder.addCase(doGetDeviceCredentials.fulfilled, (state, action) => {
            return {
                ...state,
                isFetching: false,
                data: action.payload,
            };
        });
        builder.addCase(doGetDeviceCredentials.rejected, (state) => {
            return {
                ...state,
                isFetching: false,
                error: true,
            };
        });
    },
});

/**
 * Action creators
 */

export const doGetDeviceCredentials = createAppAsyncThunk(
    "deviceCredentials/doGetDeviceCredentials",
    async (payload, { extra }) => {
        return extra.services.credentialsService.getCredentials();
    },
);

/**
 * Selectors
 */

export const selectDeviceCredentialsRaw = (state: RootState) => state.deviceCredentials;
export const selectHasFetchedDeviceCredentials = (state: RootState) => !!state.deviceCredentials.data?.credentials;
export const selectDeviceId = (state: RootState) => state.deviceCredentials.data?.credentials?.uuid;

/**
 * Reactors
 */

export const selectShouldFetchDeviceCredentials = createSelector(
    selectAppIsActive,
    selectDeviceCredentialsRaw,
    (appIsActive, deviceCredentials) => {
        if (appIsActive && !deviceCredentials.isFetching && !deviceCredentials.data && !deviceCredentials.error) {
            return true;
        }
        return false;
    },
);

createReactor([selectShouldFetchDeviceCredentials], ({ dispatch }, shouldFetchDeviceCredentials) => {
    if (shouldFetchDeviceCredentials) {
        dispatch(doGetDeviceCredentials());
    }
});
