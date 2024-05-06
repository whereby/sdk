import * as React from "react";

import { selectLocalParticipantView, selectRemoteClientViews, selectNumClients, ClientView } from "@whereby.com/core";
import { useAppSelector } from "../Provider/hooks";
import { ACTIVE_VIDEO_SUBGRID_TRIGGER, STAGE_PARTICIPANT_LIMIT } from "./contants";

export function calculateSubgridViews({
    clientViews,
    activeVideosSubgridTrigger,
    shouldShowSubgrid,
}: {
    clientViews: ClientView[];
    activeVideosSubgridTrigger: number;
    shouldShowSubgrid: boolean;
}) {
    if (!shouldShowSubgrid) {
        return [];
    }

    const allClientViews = clientViews.filter((client) => !client.isPresentation);
    const noVideoViews = allClientViews.filter((client) => !client.isVideoEnabled);
    const videoLimitReached =
        allClientViews.filter((client) => client.isVideoEnabled).length > activeVideosSubgridTrigger;

    const unmutedVideos = allClientViews.filter((client) => !noVideoViews.includes(client) && client.isAudioEnabled);
    const mutedVideos = allClientViews.filter((client) => !noVideoViews.includes(client) && !client.isAudioEnabled);

    if (noVideoViews.length) {
        return [...noVideoViews];
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
    const localParticipantView = useAppSelector(selectLocalParticipantView);
    const remoteClientViews = useAppSelector(selectRemoteClientViews);
    const numClients = useAppSelector(selectNumClients);

    const shouldShowSubgrid = React.useMemo(() => {
        return forceSubgrid ? true : numClients > stageParticipantLimit;
    }, [forceSubgrid, numClients, stageParticipantLimit]);

    const allClientViews = React.useMemo(() => {
        return [localParticipantView, ...remoteClientViews];
    }, [localParticipantView, remoteClientViews]);

    const clientViewsInSubgrid = React.useMemo(() => {
        return calculateSubgridViews({
            clientViews: allClientViews,
            activeVideosSubgridTrigger,
            shouldShowSubgrid,
        });
    }, [allClientViews, shouldShowSubgrid, activeVideosSubgridTrigger]);

    const clientViewsOnStage = React.useMemo(() => {
        return allClientViews.filter((client) => !clientViewsInSubgrid.includes(client));
    }, [allClientViews, clientViewsInSubgrid]);

    const clientViewsInPresentationGrid = React.useMemo(() => {
        return allClientViews.filter((client) => client.isPresentation);
    }, [allClientViews]);

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
