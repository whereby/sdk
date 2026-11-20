import { createSelector } from "@reduxjs/toolkit";

import { selectSpotlightedClientViews, selectNumClients, selectSortedClientViews } from "../../redux";
import { selectRunningRoomIntegrations } from "../../redux/slices/roomIntegrations";
import { selectIsAuthorizedToSpotlight } from "../../redux/slices/authorization";

export const selectGridState = createSelector(
    selectSortedClientViews,
    selectSpotlightedClientViews,
    selectNumClients,
    selectRunningRoomIntegrations,
    selectIsAuthorizedToSpotlight,
    (allClientViews, spotlightedParticipants, numClients, runningRoomIntegrations, canSpotlight) => {
        return {
            allClientViews,
            spotlightedParticipants,
            numParticipants: numClients,
            runningRoomIntegrations,
            canSpotlight,
        };
    },
);
