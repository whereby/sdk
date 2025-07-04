import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppAsyncThunk } from "../thunk";
import Organization from "../../api/models/Organization";
import { createReactor } from "../listenerMiddleware";
import { selectAppRoomUrl, selectAppIsActive } from "./app";
import { selectDeviceCredentialsRaw } from "./deviceCredentials";

/**
 * Reducer
 */

export interface OrganizationState {
    data: Organization | null | undefined;
    isFetching: boolean;
    error: unknown;
}

export const organizationSliceInitialState: OrganizationState = {
    data: null,
    isFetching: false,
    error: null,
};

export const organizationSlice = createSlice({
    name: "organization",
    initialState: organizationSliceInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(doOrganizationFetch.pending, (state) => {
            return {
                ...state,
                isFetching: true,
            };
        });
        builder.addCase(doOrganizationFetch.fulfilled, (state, action) => {
            if (!action.payload) return { ...state, isFetching: true };
            return {
                ...state,
                isFetching: false,
                data: action.payload,
            };
        });
        builder.addCase(doOrganizationFetch.rejected, (state) => {
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

export const doOrganizationFetch = createAppAsyncThunk(
    "organization/doOrganizationFetch",
    async (_, { extra, getState }) => {
        try {
            const roomUrl = selectAppRoomUrl(getState());

            const organization = await extra.services.fetchOrganizationFromRoomUrl(roomUrl || "");

            if (!organization) {
                throw new Error("Invalid room url");
            }

            return organization;
        } catch (error) {
            console.error(error);
        }
    },
);

/**
 * Selectors
 */

export const selectOrganizationRaw = (state: RootState) => state.organization;
export const selectOrganizationId = (state: RootState) => state.organization.data?.organizationId;
export const selectOrganizationPreferences = (state: RootState) => state.organization.data?.preferences;

/**
 * Reducers
 */

export const selectShouldFetchOrganization = createSelector(
    selectAppIsActive,
    selectOrganizationRaw,
    selectDeviceCredentialsRaw,
    (appIsActive, organization, deviceCredentials) => {
        if (
            appIsActive &&
            !organization.data &&
            !organization.isFetching &&
            !organization.error &&
            !deviceCredentials.isFetching
        ) {
            return true;
        }
        return false;
    },
);

createReactor([selectShouldFetchOrganization], ({ dispatch }, shouldFetchOrganization) => {
    if (shouldFetchOrganization) {
        dispatch(doOrganizationFetch());
    }
});
