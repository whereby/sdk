import { createSelector } from "@reduxjs/toolkit";
import {
    selectCellViewsVideoGrid,
    RemoteParticipant,
    CellView,
    CalculateLayoutResult,
    selectLayoutVideoStage,
    selectCellViewsPresentationGrid,
    Frame,
    selectLayoutContainerFrame,
} from "@whereby.com/core";

export type RemoteParticipantState = Omit<RemoteParticipant, "newJoiner" | "streams">;

export interface VideoGridState {
    cellViewsVideoGrid: CellView[];
    cellViewsInPresentationGrid: CellView[];
    videoStage: CalculateLayoutResult | null;
    containerFrame: Frame;
}

export const selectVideoGridState = createSelector(
    selectCellViewsVideoGrid,
    selectCellViewsPresentationGrid,
    selectLayoutVideoStage,
    selectLayoutContainerFrame,
    (cellViewsVideoGrid, cellViewsInPresentationGrid, videoStage, containerFrame) => {
        const state: VideoGridState = {
            cellViewsVideoGrid,
            cellViewsInPresentationGrid,
            videoStage,
            containerFrame,
        };

        return state;
    },
);
