import { createSelector } from "@reduxjs/toolkit";

import { selectAllClientViews, selectSpotlightedClientViews, selectNumClients } from "../../redux";

export const selectGridState = createSelector(
    selectAllClientViews,
    selectSpotlightedClientViews,
    selectNumClients,
    (allClientViews, spotlightedParticipants, numClients) => {
        return {
            allClientViews,
            spotlightedParticipants,
            numParticipants: numClients,
        };
    },
);
