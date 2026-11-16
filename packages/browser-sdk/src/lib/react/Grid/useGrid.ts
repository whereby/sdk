import * as React from "react";

import { makeFrame } from "./layout/helpers";
import { calculateLayout } from "./layout/stageLayout";
import { makeIntegrationCellView, makeVideoCellView } from "./layout/cellView";
import { STAGE_PARTICIPANT_LIMIT } from "./contants";
import { useGridParticipants } from "./useGridParticipants";
import { WherebyContext } from "../Provider";

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
    const gridClient = React.useContext(WherebyContext)?.getGrid();
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

    React.useEffect(() => {
        if (maximizedCellId && !maximizedClientView) {
            setMaximizedCellId(null);
        }
    }, [maximizedCellId, maximizedClientView]);

    React.useEffect(() => {
        if (floatingCellId && !floatingClientView) {
            setFloatingCellId(null);
        }
    }, [floatingCellId, floatingClientView]);

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

    const moveCell = React.useCallback(
        (id: string, withId: string) => {
            if (!gridClient || id === withId) {
                return;
            }

            const allCells = [
                ...cellViewsFloating,
                ...cellViewsVideoGrid,
                ...cellViewsInPresentationGrid,
                ...cellViewsInSubgrid,
                ...cellViewsHidden,
            ];
            const isVideoCell = (cellId: string) =>
                allCells.some((cell) => cell.type === "video" && cell.cellId === cellId);
            const isIntegrationCell = (cellId: string) =>
                allCells.some((cell) => cell.type === "integration" && cell.cellId === cellId);
            const stagedIntegration = cellViewsInPresentationGrid.find((cell) => cell.type === "integration");

            if (isIntegrationCell(id) || isIntegrationCell(withId)) {
                if (id === stagedIntegration?.cellId && isVideoCell(withId)) {
                    setMaximizedCellId(withId);
                } else if (withId === stagedIntegration?.cellId && isVideoCell(id)) {
                    setMaximizedCellId(id);
                }
                return;
            }

            if (!maximizedClientView) {
                const isOnStage = (cellId: string) =>
                    cellViewsInPresentationGrid.some((cell) => cell.type === "video" && cell.cellId === cellId);

                // No drop between stage and grid.
                if (isOnStage(id) || isOnStage(withId)) {
                    if (isOnStage(id) && isOnStage(withId) && gridClient.getState().canSpotlight) {
                        gridClient.swapSpotlightOrder({ id, withId });
                    }
                    return;
                }
            }

            if (maximizedClientView?.id === id && isVideoCell(withId)) {
                setMaximizedCellId(withId);
            } else if (maximizedClientView?.id === withId && isVideoCell(id)) {
                setMaximizedCellId(id);
            }

            gridClient.reorderClientViews({ id, withId });
        },
        [
            gridClient,
            cellViewsFloating,
            cellViewsVideoGrid,
            cellViewsInPresentationGrid,
            cellViewsInSubgrid,
            cellViewsHidden,
            maximizedClientView,
        ],
    );

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
        moveCell,
    };
}

export { useGrid };
