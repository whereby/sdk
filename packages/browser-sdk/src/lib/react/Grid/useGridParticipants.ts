import * as React from "react";

import {
    selectNumParticipants,
    ClientView,
    selectAllClientViews,
    selectSpotlightedClientViews,
} from "@whereby.com/core";
import { useAppSelector } from "../Provider/hooks";
import { ACTIVE_VIDEO_SUBGRID_TRIGGER, STAGE_PARTICIPANT_LIMIT } from "./contants";

export function calculateSubgridViews({
    clientViews,
    activeVideosSubgridTrigger,
    shouldShowSubgrid,
    spotlightedParticipants,
}: {
    clientViews: ClientView[];
    activeVideosSubgridTrigger: number;
    shouldShowSubgrid: boolean;
    spotlightedParticipants: ClientView[];
}) {
    if (!shouldShowSubgrid) {
        return [];
    }
    const hasSpotlights = spotlightedParticipants.length > 0;
    const hasPresentationStage = hasSpotlights;

    const notSpotlighted = clientViews.filter(
        (client) => !client.isPresentation && !spotlightedParticipants.includes(client),
    );
    const noVideoViews = notSpotlighted.filter((client) => !client.isVideoEnabled);
    const videoLimitReached =
        notSpotlighted.filter((client) => client.isVideoEnabled).length > activeVideosSubgridTrigger;

    const unmutedVideos = notSpotlighted.filter((client) => !noVideoViews.includes(client) && client.isAudioEnabled);
    const mutedVideos = notSpotlighted.filter((client) => !noVideoViews.includes(client) && !client.isAudioEnabled);

    if (noVideoViews.length && hasPresentationStage) {
        return [...mutedVideos, ...noVideoViews];
    }

    // If we reached the limit for active videos, and we have videos with muted audio,
    // prepend them to the subgrid:
    if (videoLimitReached && mutedVideos.length) {
        const sorted = [...unmutedVideos, ...mutedVideos];
        const inGrid = sorted.slice(0, activeVideosSubgridTrigger);
        // If the number of clients in the grid is shorter than the limit,
        // we only add the "left over" clients to the subgrid
        if (inGrid.length <= activeVideosSubgridTrigger) {
            return [...mutedVideos.filter((client) => !inGrid.includes(client)), ...noVideoViews];
        } else {
            return [...mutedVideos, ...noVideoViews];
        }
    }

    return noVideoViews;
}

interface Props {
    activeVideosSubgridTrigger?: number;
    forceSubgrid?: boolean;
    stageParticipantLimit?: number;
}

function useGridParticipants({
    activeVideosSubgridTrigger = ACTIVE_VIDEO_SUBGRID_TRIGGER,
    stageParticipantLimit = STAGE_PARTICIPANT_LIMIT,
    forceSubgrid = true,
}: Props = {}) {
    const allClientViews = useAppSelector(selectAllClientViews);
    const spotlightedParticipants = useAppSelector(selectSpotlightedClientViews);
    const numParticipants = useAppSelector(selectNumParticipants);

    const shouldShowSubgrid = React.useMemo(() => {
        return forceSubgrid ? true : numParticipants > stageParticipantLimit;
    }, [forceSubgrid, numParticipants, stageParticipantLimit]);

    const clientViewsInSubgrid = React.useMemo(() => {
        return calculateSubgridViews({
            clientViews: allClientViews,
            activeVideosSubgridTrigger,
            shouldShowSubgrid,
            spotlightedParticipants,
        });
    }, [allClientViews, shouldShowSubgrid, activeVideosSubgridTrigger, spotlightedParticipants]);

    const clientViewsOnStage = React.useMemo(() => {
        return allClientViews.filter((client) => !clientViewsInSubgrid.includes(client));
    }, [allClientViews, clientViewsInSubgrid]);

    const clientViewsInPresentationGrid = React.useMemo(() => {
        return allClientViews.filter((client) => client.isPresentation).concat(spotlightedParticipants);
    }, [allClientViews, spotlightedParticipants]);

    const clientViewsInGrid = React.useMemo(() => {
        return clientViewsOnStage.filter((client) => !clientViewsInPresentationGrid.includes(client));
    }, [clientViewsOnStage, clientViewsInPresentationGrid]);

    return {
        clientViewsInGrid,
        clientViewsInPresentationGrid,
        clientViewsInSubgrid,
    };
}

export { useGridParticipants };
