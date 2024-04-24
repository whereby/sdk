import { createSelector } from "@reduxjs/toolkit";
import {
    selectCellViewsVideoGrid,
    RemoteParticipant,
    CellView,
    StageLayout,
    selectLayoutVideoStage,
    selectCellViewsPresentationGrid,
    selectCellViewsSubgrid,
    Frame,
    selectLayoutContainerFrame,
} from "@whereby.com/core";

export type RemoteParticipantState = Omit<RemoteParticipant, "newJoiner" | "streams">;

export interface VideoGridState {
    cellViewsVideoGrid: CellView[];
    cellViewsInPresentationGrid: CellView[];
    cellViewsInSubgrid: CellView[];
    videoStage: StageLayout | null;
    containerFrame: Frame;
}

export const selectVideoGridState = createSelector(
    selectCellViewsVideoGrid,
    selectCellViewsPresentationGrid,
    selectCellViewsSubgrid,
    selectLayoutVideoStage,
    selectLayoutContainerFrame,
    (cellViewsVideoGrid, cellViewsInPresentationGrid, cellViewsInSubgrid, videoStage, containerFrame) => {
        const state: VideoGridState = {
            cellViewsVideoGrid,
            cellViewsInPresentationGrid,
            cellViewsInSubgrid,
            videoStage,
            containerFrame,
        };

        return state;
    },
);
