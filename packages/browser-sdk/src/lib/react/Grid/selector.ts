import { createSelector } from "@reduxjs/toolkit";
import { selectAllClientViews } from "@whereby.com/core";

export const selectClientViewsInSubgrid = createSelector(selectAllClientViews, (allClientViews) => {
    const videos = allClientViews.filter((client) => !client.isPresentation);
    return videos.filter((client) => !client.isAudioEnabled);
});
export const selectClientViewsOnStage = createSelector(
    selectAllClientViews,
    selectClientViewsInSubgrid,
    (allClientViews, clientViewsInSubgrid) => {
        return allClientViews.filter((client) => !clientViewsInSubgrid.includes(client));
    },
);
export const selectClientViewsInPresentationGrid = createSelector(selectAllClientViews, (allClientViews) => {
    return allClientViews.filter((client) => client.isPresentation);
});
export const selectClientViewsInGrid = createSelector(
    selectClientViewsInPresentationGrid,
    selectClientViewsOnStage,
    (clientViewsInPresentationGrid, clientViewsOnStage) => {
        return clientViewsOnStage.filter((client) => !clientViewsInPresentationGrid.includes(client));
    },
);
