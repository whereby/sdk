import * as React from "react";

import { makeFrame } from "./layout/helpers";
import { calculateLayout } from "./layout/stageLayout";
import { makeVideoCellView } from "./layout/cellView";
import { STAGE_PARTICIPANT_LIMIT } from "./contants";
import { useGridParticipants } from "./useGridParticipants";
import { ClientView } from "packages/core/dist";

interface Props {
    activeVideosSubgridTrigger?: number;
    forceSubgrid?: boolean;
    stageParticipantLimit?: number;
    gridGap?: number;
    videoGridGap?: number;
    enableSubgrid?: boolean;
}

function useGrid({
    activeVideosSubgridTrigger,
    forceSubgrid,
    stageParticipantLimit = STAGE_PARTICIPANT_LIMIT,
    gridGap = 8,
    videoGridGap = 8,
    enableSubgrid = true,
}: Props = {}) {
    const [containerBounds, setContainerBounds] = React.useState({ width: 0, height: 0 });
    const [clientAspectRatios, setClientAspectRatios] = React.useState<{ [key: string]: number }>({});
    const [maximizedParticipant, setMaximizedParticipant] = React.useState<ClientView | null>(null);
    const [floatingParticipant, setFloatingParticipant] = React.useState<ClientView | null>(null);
    const { clientViewsInGrid, clientViewsInPresentationGrid, clientViewsInSubgrid, floatingClientView } =
        useGridParticipants({
            activeVideosSubgridTrigger,
            forceSubgrid,
            stageParticipantLimit,
            enableSubgrid,
            maximizedParticipant,
            floatingParticipant,
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

    const cellViewsInPresentationGrid = React.useMemo(() => {
        return clientViewsInPresentationGrid.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: { top: 0, right: 0 },
            });
        });
    }, [clientViewsInPresentationGrid, clientAspectRatios]);

    const cellViewsInSubgrid = React.useMemo(() => {
        return clientViewsInSubgrid.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: { top: 0, right: 0 },
                isSubgrid: true,
            });
        });
    }, [clientViewsInSubgrid, clientAspectRatios]);

    const containerFrame = React.useMemo(() => {
        return makeFrame(containerBounds);
    }, [containerBounds]);

    const videoStage = React.useMemo(() => {
        return calculateLayout({
            floatingVideo: cellViewsFloating[0],
            frame: containerFrame,
            gridGap,
            isConstrained: false,
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
        clientAspectRatios,
        videoStage,
        setContainerBounds,
        setClientAspectRatios,
        maximizedParticipant,
        setMaximizedParticipant,
        floatingParticipant,
        setFloatingParticipant,
    };
}

export { useGrid };
