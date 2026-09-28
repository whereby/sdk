import * as React from "react";

import { ClientView, GridState, RoomIntegrationSessionView } from "@whereby.com/core";
import { ACTIVE_VIDEO_SUBGRID_TRIGGER, ACTIVE_VIDEOS_PHONE_LIMIT, STAGE_PARTICIPANT_LIMIT } from "./contants";
import { WherebyContext } from "../Provider";

export function calculateSubgridViews({
    clientViews,
    activeVideosSubgridTrigger,
    shouldShowSubgrid,
    spotlightedParticipants,
    maximizedCellId,
    hasStagedIntegration = false,
    isPhoneResolution,
}: {
    clientViews: ClientView[];
    activeVideosSubgridTrigger: number;
    shouldShowSubgrid: boolean;
    spotlightedParticipants: ClientView[];
    maximizedCellId?: string | null;
    hasStagedIntegration?: boolean;
    isPhoneResolution?: boolean;
}) {
    if (!shouldShowSubgrid) {
        return [];
    }
    const hasSpotlights = spotlightedParticipants.length > 0;
    const hasPresentationStage = hasSpotlights || hasStagedIntegration;

    const notMaximized = maximizedCellId ? clientViews.filter((client) => client.id !== maximizedCellId) : clientViews;

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
    maximizedCellId?: string | null;
    floatingCellId?: string | null;
    isConstrained?: boolean;
}

function useGridParticipants({
    activeVideosSubgridTrigger = ACTIVE_VIDEO_SUBGRID_TRIGGER,
    stageParticipantLimit = STAGE_PARTICIPANT_LIMIT,
    forceSubgrid = true,
    enableSubgrid = true,
    maximizedCellId,
    floatingCellId,
    isConstrained = false,
}: Props = {}) {
    const client = React.useContext(WherebyContext)?.getGrid();

    if (!client) {
        throw new Error("useGridParticipants must be used within a WherebyProvider");
    }

    const [state, setState] = React.useState<GridState>(() => client.getState());

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

    const handleRunningRoomIntegrationsChanged = React.useCallback(
        (runningRoomIntegrations: RoomIntegrationSessionView[]) => {
            setState((prevState) => ({
                ...prevState,
                runningRoomIntegrations,
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
        const unsubscribeRunningRoomIntegrations = client.subscribeRunningRoomIntegrations(
            handleRunningRoomIntegrationsChanged,
        );

        setState(client.getState());

        return () => {
            unsubscribeClientViews();
            unsubscribeSpotlighted();
            unsubscribeNumParticipants();
            unsubscribeRunningRoomIntegrations();
        };
    }, [client]);

    const allClientViews = React.useMemo(() => state.allClientViews, [state.allClientViews]);
    const spotlightedParticipants = React.useMemo(() => state.spotlightedParticipants, [state.spotlightedParticipants]);
    const numParticipants = React.useMemo(() => state.numParticipants, [state.numParticipants]);
    const runningRoomIntegrations = React.useMemo(() => state.runningRoomIntegrations, [state.runningRoomIntegrations]);

    // Resolved from the live list on every render rather than held: client views are rebuilt
    // whenever the store updates, so a captured object still reports the video state it had when
    // the consumer picked it, and no longer matches the object the grid is laying out.
    const maximizedClientView = React.useMemo(
        () => (maximizedCellId ? allClientViews.find((client) => client.id === maximizedCellId) || null : null),
        [allClientViews, maximizedCellId],
    );

    const floatingClientView = React.useMemo(
        () => (floatingCellId ? allClientViews.find((client) => client.id === floatingCellId) || null : null),
        [allClientViews, floatingCellId],
    );

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

    const integrationsInPresentationGrid = React.useMemo(() => {
        if (!runningRoomIntegrations.length || maximizedClientView) {
            return [];
        }
        return [runningRoomIntegrations[0]];
    }, [runningRoomIntegrations, maximizedClientView]);

    const integrationsInSubgrid = React.useMemo(() => {
        if (!shouldShowSubgrid) {
            return [];
        }
        return runningRoomIntegrations.filter(
            (session) =>
                !integrationsInPresentationGrid.some(
                    (staged) => staged.roomIntegrationSessionId === session.roomIntegrationSessionId,
                ),
        );
    }, [runningRoomIntegrations, integrationsInPresentationGrid, shouldShowSubgrid]);

    const integrationsHidden = React.useMemo(() => {
        const visible = [...integrationsInPresentationGrid, ...integrationsInSubgrid];
        return runningRoomIntegrations.filter(
            (session) => !visible.some((shown) => shown.roomIntegrationSessionId === session.roomIntegrationSessionId),
        );
    }, [runningRoomIntegrations, integrationsInPresentationGrid, integrationsInSubgrid]);

    const clientViewsInSubgrid = React.useMemo(() => {
        return calculateSubgridViews({
            clientViews: clientViewsNotFloating,
            activeVideosSubgridTrigger,
            shouldShowSubgrid,
            spotlightedParticipants,
            maximizedCellId,
            hasStagedIntegration: integrationsInPresentationGrid.length > 0,
            isPhoneResolution: isConstrained,
        });
    }, [
        clientViewsNotFloating,
        shouldShowSubgrid,
        activeVideosSubgridTrigger,
        spotlightedParticipants,
        maximizedCellId,
        integrationsInPresentationGrid,
        isConstrained,
    ]);

    const clientViewsOnStage = React.useMemo(() => {
        return clientViewsNotFloating.filter((client) => !clientViewsInSubgrid.includes(client));
    }, [clientViewsNotFloating, clientViewsInSubgrid]);

    const clientViewsInPresentationGrid = React.useMemo(() => {
        if (maximizedClientView) {
            return [maximizedClientView];
        }

        if (integrationsInPresentationGrid.length) {
            return [];
        }

        return spotlightedParticipants.filter((client) => clientViewsOnStage.includes(client));
    }, [spotlightedParticipants, maximizedClientView, integrationsInPresentationGrid, clientViewsOnStage]);

    const clientViewsInGrid = React.useMemo(() => {
        return clientViewsOnStage.filter((client) => !clientViewsInPresentationGrid.includes(client));
    }, [clientViewsOnStage, clientViewsInPresentationGrid]);

    return {
        floatingClientView,
        maximizedClientView,
        clientViewsInGrid,
        clientViewsInPresentationGrid,
        clientViewsInSubgrid,
        integrationsInPresentationGrid,
        integrationsInSubgrid,
        integrationsHidden,
        spotlightedParticipants,
    };
}

export { useGridParticipants };
