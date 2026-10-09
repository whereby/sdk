import * as React from "react";

import { makeFrame } from "./layout/helpers";
import { calculateLayout } from "./layout/stageLayout";
import { makeIntegrationCellView, makeVideoCellView } from "./layout/cellView";
import { STAGE_PARTICIPANT_LIMIT } from "./contants";
import { useGridParticipants } from "./useGridParticipants";

interface Props {
    activeVideosSubgridTrigger?: number;
    forceSubgrid?: boolean;
    stageParticipantLimit?: number;
    gridGap?: number;
    videoGridGap?: number;
    enableSubgrid?: boolean;
    enableConstrainedGrid?: boolean;
    /**
     * Lay out running room integrations as cells of type "integration". Off by default, because you
     * render the cells yourself: turn it on once you render integration cells, or a running
     * integration would take the stage and show nothing.
     */
    includeIntegrations?: boolean;
}

function useGrid({
    activeVideosSubgridTrigger,
    forceSubgrid,
    stageParticipantLimit = STAGE_PARTICIPANT_LIMIT,
    gridGap = 8,
    videoGridGap = 8,
    enableSubgrid = true,
    enableConstrainedGrid = true,
    includeIntegrations = false,
}: Props = {}) {
    const [containerBounds, setContainerBounds] = React.useState({ width: 0, height: 0 });
    const [isConstrained, setIsConstrained] = React.useState(false);
    const [clientAspectRatios, setClientAspectRatios] = React.useState<{ [key: string]: number }>({});
    const [maximizedCellId, setMaximizedCellId] = React.useState<string | null>(null);
    const [floatingCellId, setFloatingCellId] = React.useState<string | null>(null);
    const {
        clientViewsInGrid,
        clientViewsInPresentationGrid,
        clientViewsInSubgrid,
        floatingClientView,
        maximizedClientView,
        integrationsInPresentationGrid,
        integrationsInSubgrid,
        integrationsHidden,
    } = useGridParticipants({
        activeVideosSubgridTrigger,
        forceSubgrid,
        stageParticipantLimit,
        enableSubgrid,
        maximizedCellId,
        floatingCellId,
        isConstrained: !!enableConstrainedGrid && !!isConstrained,
        includeIntegrations,
    });

    const cellViewsFloating = React.useMemo(() => {
        return floatingClientView
            ? [
                  makeVideoCellView({
                      client: floatingClientView,
                      aspectRatio: clientAspectRatios[floatingClientView.id],
                      avatarSize: 0,
                      cellPaddings: { top: 0, right: 0 },
                  }),
              ]
            : [];
    }, [floatingClientView, clientAspectRatios]);

    const cellViewsVideoGrid = React.useMemo(() => {
        return clientViewsInGrid.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: { top: 0, right: 0 },
            });
        });
    }, [clientViewsInGrid, clientAspectRatios]);

    // Integrations first, so the stage keeps a stable order when spotlights come and go around it.
    const cellViewsInPresentationGrid = React.useMemo(() => {
        return [
            ...integrationsInPresentationGrid.map((session) => makeIntegrationCellView({ session })),
            ...clientViewsInPresentationGrid.map((client) => {
                return makeVideoCellView({
                    client,
                    aspectRatio: clientAspectRatios[client.id],
                    avatarSize: 0,
                    cellPaddings: { top: 0, right: 0 },
                });
            }),
        ];
    }, [clientViewsInPresentationGrid, integrationsInPresentationGrid, clientAspectRatios]);

    const cellViewsInSubgrid = React.useMemo(() => {
        return [
            ...clientViewsInSubgrid.map((client) => {
                return makeVideoCellView({
                    client,
                    aspectRatio: clientAspectRatios[client.id],
                    avatarSize: 0,
                    cellPaddings: { top: 0, right: 0 },
                    isSubgrid: true,
                });
            }),
            ...integrationsInSubgrid.map((session) => makeIntegrationCellView({ session, isSubgrid: true })),
        ];
    }, [clientViewsInSubgrid, integrationsInSubgrid, clientAspectRatios]);

    const cellViewsHidden = React.useMemo(() => {
        return integrationsHidden.map((session) => makeIntegrationCellView({ session }));
    }, [integrationsHidden]);

    const containerFrame = React.useMemo(() => {
        return makeFrame(containerBounds);
    }, [containerBounds]);

    React.useEffect(() => {
        if (!enableConstrainedGrid) {
            return;
        }

        setIsConstrained(containerBounds.width < 500 || containerBounds.height < 500);
    }, [containerBounds, enableConstrainedGrid]);

    const videoStage = React.useMemo(() => {
        return calculateLayout({
            floatingVideo: cellViewsFloating[0],
            frame: containerFrame,
            gridGap,
            isConstrained,
            roomBounds: containerFrame.bounds,
            videos: cellViewsVideoGrid,
            videoGridGap,
            presentationVideos: cellViewsInPresentationGrid,
            subgridVideos: cellViewsInSubgrid,
        });
    }, [
        containerFrame,
        cellViewsFloating,
        cellViewsVideoGrid,
        cellViewsInPresentationGrid,
        cellViewsInSubgrid,
        gridGap,
        videoGridGap,
    ]);

    return {
        containerFrame,
        cellViewsFloating,
        cellViewsVideoGrid,
        cellViewsInPresentationGrid,
        cellViewsInSubgrid,
        cellViewsHidden,
        clientAspectRatios,
        videoStage,
        setContainerBounds,
        setClientAspectRatios,
        maximizedCellId,
        setMaximizedCellId,
        maximizedParticipant: maximizedClientView,
        floatingCellId,
        setFloatingCellId,
        floatingParticipant: floatingClientView,
        isConstrained,
    };
}

export { useGrid };
