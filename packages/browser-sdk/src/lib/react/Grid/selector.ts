import { createSelector } from "@reduxjs/toolkit";
import {
    selectRemoteParticipants,
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    LocalParticipantState,
    RemoteParticipant,
} from "@whereby.com/core";

export type RemoteParticipantState = Omit<RemoteParticipant, "newJoiner" | "streams">;

export interface VideoGridState {
    localParticipant?: LocalParticipantState;
    remoteParticipants: RemoteParticipantState[];
}

export const selectVideoGridState = createSelector(
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    selectRemoteParticipants,
    (localParticipant, localMediaStream, remoteParticipants) => {
        const state: VideoGridState = {
            localParticipant: { ...localParticipant, stream: localMediaStream },
            remoteParticipants,
        };

        return state;
    },
);
