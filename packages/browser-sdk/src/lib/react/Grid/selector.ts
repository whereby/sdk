import { createSelector } from "@reduxjs/toolkit";
import {
    selectCellViewsVideoGrid,
    RemoteParticipant,
    CellView,
    CalculateLayoutResult,
    selectLayoutVideoStage,
    selectCellViewsPresentationGrid,
} from "@whereby.com/core";

export type RemoteParticipantState = Omit<RemoteParticipant, "newJoiner" | "streams">;

export interface VideoGridState {
    cellViewsVideoGrid: CellView[];
    cellViewsInPresentationGrid: CellView[];
    videoStage: CalculateLayoutResult | undefined;
}

export const selectVideoGridState = createSelector(
    selectCellViewsVideoGrid,
    selectCellViewsPresentationGrid,
    selectLayoutVideoStage,
    (cellViewsVideoGrid, cellViewsInPresentationGrid, videoStage) => {
        const state: VideoGridState = {
            cellViewsVideoGrid,
            cellViewsInPresentationGrid,
            videoStage,
        };

        return state;
    },
);
