import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { selectLocalMediaStream } from "../localMedia";
import { ClientView } from "../../types";
import { NON_PERSON_ROLES } from "../../constants";

/**
 * Selectors
 */

export const selectLocalParticipantRaw = (state: RootState) => state.localParticipant;
export const selectSelfId = (state: RootState) => state.localParticipant.id;
export const selectLocalParticipantDisplayName = (state: RootState) => state.localParticipant.displayName;
export const selectLocalParticipantClientClaim = (state: RootState) => state.localParticipant.clientClaim;
export const selectLocalParticipantIsScreenSharing = (state: RootState) => state.localParticipant.isScreenSharing;
export const selectLocalParticipantStickyReaction = (state: RootState) => state.localParticipant.stickyReaction;
export const selectLocalParticipantBreakoutGroup = (state: RootState) => state.localParticipant.breakoutGroup;
export const selectLocalParticipantBreakoutAssigned = (state: RootState) =>
    state.localParticipant.breakoutGroupAssigned;

export const selectLocalParticipantView = createSelector(
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    (participant, localStream) => {
        const clientView: ClientView = {
            id: participant.id,
            clientId: participant.id,
            breakoutGroup: participant.breakoutGroup,
            displayName: participant.displayName,
            stream: localStream,
            isLocalClient: true,
            isAudioEnabled: participant.isAudioEnabled,
            isVideoEnabled: participant.isVideoEnabled,
        };

        if (NON_PERSON_ROLES.includes(participant.roleName)) {
            return null;
        }

        return clientView;
    },
);
