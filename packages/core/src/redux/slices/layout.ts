import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { selectRemoteClientViews } from "./remoteParticipants";
import { selectLocalParticipantView } from "./localParticipant";
import { ClientView } from "../types";

export function sortClientViews({
    sortedClientIds = [],
    clients = [],
}: {
    sortedClientIds: string[];
    clients: ClientView[];
}) {
    if (!sortedClientIds.length) {
        return clients;
    }
    // Append IDs we haven't seen before, maintaining their existing order
    // (new clients are always added to the end)
    const newIds = clients.filter((client) => !sortedClientIds.includes(client.id)).map((client) => client.id);
    sortedClientIds = [...sortedClientIds, ...newIds];
    // Sort clients based on cached sort index
    const sortedClients = [...clients].sort((a, b) => {
        return sortedClientIds.indexOf(a.id) - sortedClientIds.indexOf(b.id);
    });
    return sortedClients;
}

/**
 * Reducer
 */
export interface LayoutState {
    aspectRatios: Record<string, number>;
    sortedClientIds: string[];
}

const initialState: LayoutState = {
    aspectRatios: {},
    sortedClientIds: [],
};

export const layoutSlice = createSlice({
    name: "layout",
    initialState,
    reducers: {
        setAspectRatio: (state, action: { payload: { clientId: string; aspectRatio: number } }) => {
            return {
                ...state,
                aspectRatios: {
                    ...state.aspectRatios,
                    [action.payload.clientId]: action.payload.aspectRatio,
                },
            };
        },
    },
});

/**
 * Action creators
 */

export const { setAspectRatio } = layoutSlice.actions;

/**
 * Selectors
 */
export const selectLayoutRaw = (state: RootState) => state.layout;
export const selectLayoutClientAspectRatios = (state: RootState) => state.layout.aspectRatios;
export const selectLayoutSortedClientIds = (state: RootState) => state.layout.sortedClientIds;
export const selectAllClientViews = createSelector(
    selectLocalParticipantView,
    selectRemoteClientViews,
    selectLayoutSortedClientIds,
    (localParticipant, remoteParticipants, sortedClientIds) => {
        return sortClientViews({
            sortedClientIds,
            clients: [localParticipant, ...remoteParticipants],
        });
    },
);
export const selectClientViewsInSubgrid = createSelector(selectAllClientViews, (allClientViews) => {
    const videos = allClientViews.filter((client) => !client.isPresentation);
    return videos.filter((client) => !client.isAudioEnabled);
});
export const selectClientViewsOnStage = createSelector(
    selectAllClientViews,
    selectClientViewsInSubgrid,
    (allClientViews, clientViewsInSubgrid) => {
        return allClientViews.filter((client) => !clientViewsInSubgrid.includes(client));
    },
);
export const selectClientViewsInPresentationGrid = createSelector(selectAllClientViews, (allClientViews) => {
    return allClientViews.filter((client) => client.isPresentation);
});
export const selectClientViewsInGrid = createSelector(
    selectClientViewsInPresentationGrid,
    selectClientViewsOnStage,
    (clientViewsInPresentationGrid, clientViewsOnStage) => {
        return clientViewsOnStage.filter((client) => !clientViewsInPresentationGrid.includes(client));
    },
);
