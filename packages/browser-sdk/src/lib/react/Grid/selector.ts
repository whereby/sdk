import { createSelector } from "@reduxjs/toolkit";
import {
    selectCellViewsVideoGrid,
    selectRemoteParticipants,
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    LocalParticipantState,
    RemoteParticipant,
    CellView,
    CalculateLayoutResult,
    selectLayoutVideoStage,
} from "@whereby.com/core";

export type RemoteParticipantState = Omit<RemoteParticipant, "newJoiner" | "streams">;

export interface VideoGridState {
    cellViewsVideoGrid: CellView[];
    localParticipant?: LocalParticipantState;
    remoteParticipants: RemoteParticipantState[];
    videoStage: CalculateLayoutResult | undefined;
}

export const selectVideoGridState = createSelector(
    selectCellViewsVideoGrid,
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    selectRemoteParticipants,
    selectLayoutVideoStage,
    (cellViewsVideoGrid, localParticipant, localMediaStream, remoteParticipants, videoStage) => {
        const state: VideoGridState = {
            cellViewsVideoGrid,
            localParticipant: { ...localParticipant, stream: localMediaStream },
            remoteParticipants,
            videoStage,
        };

        return state;
    },
);
