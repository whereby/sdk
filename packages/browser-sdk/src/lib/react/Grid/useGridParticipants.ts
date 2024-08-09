import * as React from "react";

import {
    selectNumParticipants,
    ClientView,
    selectAllClientViews,
    selectSpotlightedClientViews,
} from "@whereby.com/core";
import { useAppSelector } from "../Provider/hooks";
import { ACTIVE_VIDEO_SUBGRID_TRIGGER, ACTIVE_VIDEOS_PHONE_LIMIT, STAGE_PARTICIPANT_LIMIT } from "./contants";

export function calculateSubgridViews({
    clientViews,
    activeVideosSubgridTrigger,
    shouldShowSubgrid,
    spotlightedParticipants,
    maximizedParticipant,
    isPhoneResolution,
}: {
    clientViews: ClientView[];
    activeVideosSubgridTrigger: number;
    shouldShowSubgrid: boolean;
    spotlightedParticipants: ClientView[];
    maximizedParticipant?: ClientView | null;
    isPhoneResolution?: boolean;
}) {
    if (!shouldShowSubgrid) {
        return [];
    }
    const hasSpotlights = spotlightedParticipants.length > 0;
    const hasPresentationStage = hasSpotlights;

    const notMaximized = maximizedParticipant
        ? clientViews.filter((client) => client.id !== maximizedParticipant.id)
        : clientViews;

    const notSpotlighted = notMaximized.filter(
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

    if (isPhoneResolution && notSpotlighted.length > ACTIVE_VIDEOS_PHONE_LIMIT) {
        const sorted = [...unmutedVideos, ...mutedVideos];
        const inGrid = sorted.slice(0, ACTIVE_VIDEOS_PHONE_LIMIT);

        if (inGrid.length <= ACTIVE_VIDEOS_PHONE_LIMIT) {
            return [...sorted.filter((client) => !inGrid.includes(client)), ...noVideoViews];
        } else {
            return [...mutedVideos, ...noVideoViews];
        }
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
    enableSubgrid?: boolean;
    maximizedParticipant?: ClientView | null;
    floatingParticipant?: ClientView | null;
    isConstrained?: boolean;
}

function useGridParticipants({
    activeVideosSubgridTrigger = ACTIVE_VIDEO_SUBGRID_TRIGGER,
    stageParticipantLimit = STAGE_PARTICIPANT_LIMIT,
    forceSubgrid = true,
    enableSubgrid = true,
    maximizedParticipant,
    floatingParticipant,
    isConstrained = false,
}: Props = {}) {
    const allClientViews = useAppSelector(selectAllClientViews);
    const spotlightedParticipants = useAppSelector(selectSpotlightedClientViews);
    const numParticipants = useAppSelector(selectNumParticipants);

    const floatingClientView = React.useMemo(() => {
        return floatingParticipant;
    }, [floatingParticipant]);

    const clientViewsNotFloating = React.useMemo(() => {
        if (floatingClientView) {
            return allClientViews.filter((c) => c.id !== floatingClientView.id);
        }
        return allClientViews;
    }, [allClientViews, floatingClientView]);

    const shouldShowSubgrid = React.useMemo(() => {
        if (!enableSubgrid) {
            return false;
        }
        return forceSubgrid ? true : numParticipants > stageParticipantLimit;
    }, [forceSubgrid, numParticipants, stageParticipantLimit, enableSubgrid]);

    const clientViewsInSubgrid = React.useMemo(() => {
        return calculateSubgridViews({
            clientViews: clientViewsNotFloating,
            activeVideosSubgridTrigger,
            shouldShowSubgrid,
            spotlightedParticipants,
            maximizedParticipant,
            isPhoneResolution: isConstrained,
        });
    }, [clientViewsNotFloating, shouldShowSubgrid, activeVideosSubgridTrigger, spotlightedParticipants, isConstrained]);

    const clientViewsOnStage = React.useMemo(() => {
        return clientViewsNotFloating.filter((client) => !clientViewsInSubgrid.includes(client));
    }, [clientViewsNotFloating, clientViewsInSubgrid]);

    const clientViewsInPresentationGrid = React.useMemo(() => {
        if (maximizedParticipant) {
            return [maximizedParticipant];
        }

        return spotlightedParticipants;
    }, [spotlightedParticipants, maximizedParticipant]);

    const clientViewsInGrid = React.useMemo(() => {
        return clientViewsOnStage.filter((client) => !clientViewsInPresentationGrid.includes(client));
    }, [clientViewsOnStage, clientViewsInPresentationGrid]);

    return {
        floatingClientView,
        clientViewsInGrid,
        clientViewsInPresentationGrid,
        clientViewsInSubgrid,
    };
}

export { useGridParticipants };
