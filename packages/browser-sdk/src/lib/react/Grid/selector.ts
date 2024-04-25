import { createSelector } from "@reduxjs/toolkit";
import {
    selectClientViewsInSubgrid,
    selectLayoutClientAspectRatios,
    selectClientViewsInPresentationGrid,
    selectClientViewsInGrid,
} from "@whereby.com/core";
import { makeVideoCellView } from "./layout/cellView";
import { type CellView } from "./layout/types";

const selectCellViewsSubgrid = createSelector(
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

const selectCellViewsPresentationGrid = createSelector(
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

const selectCellViewsVideoGrid = createSelector(
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

export interface VideoGridState {
    cellViewsVideoGrid: CellView[];
    cellViewsInPresentationGrid: CellView[];
    cellViewsInSubgrid: CellView[];
}

export const selectVideoGridState = createSelector(
    selectCellViewsVideoGrid,
    selectCellViewsPresentationGrid,
    selectCellViewsSubgrid,
    (cellViewsVideoGrid, cellViewsInPresentationGrid, cellViewsInSubgrid) => {
        const state: VideoGridState = {
            cellViewsVideoGrid,
            cellViewsInPresentationGrid,
            cellViewsInSubgrid,
        };

        return state;
    },
);
