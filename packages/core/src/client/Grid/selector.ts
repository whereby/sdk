import { createSelector } from "@reduxjs/toolkit";

import { selectAllClientViews, selectSpotlightedClientViews, selectNumClients } from "../../redux";
import { selectRunningRoomIntegrations } from "../../redux/slices/roomIntegrations";

export const selectGridState = createSelector(
    selectAllClientViews,
    selectSpotlightedClientViews,
    selectNumClients,
    selectRunningRoomIntegrations,
    (allClientViews, spotlightedParticipants, numClients, runningRoomIntegrations) => {
        return {
            allClientViews,
            spotlightedParticipants,
            numParticipants: numClients,
            runningRoomIntegrations,
        };
    },
);
