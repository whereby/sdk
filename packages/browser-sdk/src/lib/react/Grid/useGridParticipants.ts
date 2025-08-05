import * as React from "react";

import { ClientView, GridState } from "@whereby.com/core";
import { ACTIVE_VIDEO_SUBGRID_TRIGGER, ACTIVE_VIDEOS_PHONE_LIMIT, STAGE_PARTICIPANT_LIMIT } from "./contants";
import { WherebyContext } from "../Provider";

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
    const [state, setState] = React.useState<GridState>({
        allClientViews: [],
        spotlightedParticipants: [],
        numParticipants: 0,
    });
    const client = React.useContext(WherebyContext)?.getGrid();

    if (!client) {
        throw new Error("useGridParticipants must be used within a WherebyProvider");
    }

    const handleClientViewChanged = React.useCallback(
        (clientViews: ClientView[]) => {
            setState((prevState) => ({
                ...prevState,
                allClientViews: clientViews,
            }));
        },
        [setState],
    );

    const handleSpotlightedParticipantsChanged = React.useCallback(
        (spotlighted: ClientView[]) => {
            setState((prevState) => ({
                ...prevState,
                spotlightedParticipants: spotlighted,
            }));
        },
        [setState],
    );

    const handleNumParticipantsChanged = React.useCallback(
        (num: number) => {
            setState((prevState) => ({
                ...prevState,
                numParticipants: num,
            }));
        },
        [setState],
    );

    React.useEffect(() => {
        const unsubscribeClientViews = client.subscribeClientViews(handleClientViewChanged);
        const unsubscribeSpotlighted = client.subscribeSpotlightedParticipants(handleSpotlightedParticipantsChanged);
        const unsubscribeNumParticipants = client.subscribeNumberOfClientViews(handleNumParticipantsChanged);

        return () => {
            unsubscribeClientViews();
            unsubscribeSpotlighted();
            unsubscribeNumParticipants();
        };
    }, [client]);

    const allClientViews = React.useMemo(() => state.allClientViews, [state.allClientViews]);
    const spotlightedParticipants = React.useMemo(() => state.spotlightedParticipants, [state.spotlightedParticipants]);
    const numParticipants = React.useMemo(() => state.numParticipants, [state.numParticipants]);

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
        spotlightedParticipants,
    };
}

export { useGridParticipants };
