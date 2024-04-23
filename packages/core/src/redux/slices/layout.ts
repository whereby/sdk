import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { selectRemoteClientViews } from "./remoteParticipants";
import { makeVideoCellView } from "../../utils/layout/cellView";
import { ClientView, type Bounds, type Frame } from "../../utils/layout/types";
import { makeFrame } from "../../utils/layout";
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
export const selectClientViewsOnStage = createSelector(selectAllClientViews, (allClientViews) => {
    return allClientViews;
});
export const selectClientViewsInPresentationGrid = createSelector(selectAllClientViews, (allClientViews) => {
    return allClientViews.filter((client) => client.isPresentation);
});
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
    selectAllClientViews,
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
    selectLayoutContainerFrame,
    (cellViews, cellViewsInPresentationGrid, containerFrame) => {
        return calculateLayout({
            frame: containerFrame,
            gridGap: 0,
            isConstrained: false,
            roomBounds: containerFrame.bounds,
            videos: cellViews,
            videoGridGap: 0,
            presentationVideos: cellViewsInPresentationGrid,
        });
    },
);
