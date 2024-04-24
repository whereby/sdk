import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { selectRemoteClientViews } from "./remoteParticipants";
import { makeVideoCellView } from "../../utils/layout/cellView";
import { ClientView, type Bounds, type Frame } from "../../utils/layout/types";
import { makeFrame } from "../../utils/layout/helpers";
import { calculateLayout } from "../../utils/layout/stageLayout";
import { selectLocalParticipantView } from "./localParticipant";

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
    containerBounds: Bounds;
    containerFrame?: Frame;
    sortedClientIds: string[];
}

const initialState: LayoutState = {
    aspectRatios: {},
    containerBounds: { width: 0, height: 0 },
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
        setContainerBounds: (state, action: { payload: Bounds }) => {
            return {
                ...state,
                containerBounds: action.payload,
            };
        },
    },
});

/**
 * Action creators
 */

export const { setAspectRatio, setContainerBounds } = layoutSlice.actions;

/**
 * Selectors
 */
export const selectLayoutRaw = (state: RootState) => state.layout;
export const selectLayoutClientAspectRatios = (state: RootState) => state.layout.aspectRatios;
export const selectLayoutContainerBounds = (state: RootState) => state.layout.containerBounds;
export const selectLayoutSortedClientIds = (state: RootState) => state.layout.sortedClientIds;
export const selectLayoutContainerFrame = createSelector(selectLayoutContainerBounds, (containerBounds) => {
    return makeFrame(containerBounds);
});
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
export const selectCellViewsSubgrid = createSelector(
    selectClientViewsInSubgrid,
    selectLayoutClientAspectRatios,
    (clientViews, clientAspectRatios) => {
        return clientViews.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: 0,
                isSubgrid: true,
            });
        });
    },
);
export const selectCellViewsPresentationGrid = createSelector(
    selectClientViewsInPresentationGrid,
    selectLayoutClientAspectRatios,
    (clientViews, clientAspectRatios) => {
        return clientViews.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: 0,
            });
        });
    },
);
export const selectCellViewsVideoGrid = createSelector(
    selectLayoutClientAspectRatios,
    selectClientViewsInGrid,
    (clientAspectRatios, clientViews) => [
        ...clientViews.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: 10,
            });
        }),
    ],
);
export const selectLayoutVideoStage = createSelector(
    selectCellViewsVideoGrid,
    selectCellViewsPresentationGrid,
    selectCellViewsSubgrid,
    selectLayoutContainerFrame,
    (cellViews, cellViewsInPresentationGrid, cellViewsSubgrid, containerFrame) => {
        return calculateLayout({
            frame: containerFrame,
            gridGap: 8,
            isConstrained: false,
            roomBounds: containerFrame.bounds,
            videos: cellViews,
            videoGridGap: 0,
            presentationVideos: cellViewsInPresentationGrid,
            subgridVideos: cellViewsSubgrid,
        });
    },
);
