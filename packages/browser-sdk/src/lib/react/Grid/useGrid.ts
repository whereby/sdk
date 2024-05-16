import * as React from "react";

import { makeFrame } from "./layout/helpers";
import { calculateLayout } from "./layout/stageLayout";
import { makeVideoCellView } from "./layout/cellView";
import { STAGE_PARTICIPANT_LIMIT } from "./contants";
import { useGridParticipants } from "./useGridParticipants";

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
    const { clientViewsInGrid, clientViewsInPresentationGrid, clientViewsInSubgrid } = useGridParticipants({
        activeVideosSubgridTrigger,
        forceSubgrid,
        stageParticipantLimit,
        enableSubgrid,
    });

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
            frame: containerFrame,
            gridGap,
            isConstrained: false,
            roomBounds: containerFrame.bounds,
            videos: cellViewsVideoGrid,
            videoGridGap,
            presentationVideos: cellViewsInPresentationGrid,
            subgridVideos: cellViewsInSubgrid,
        });
    }, [containerFrame, cellViewsVideoGrid, cellViewsInPresentationGrid, cellViewsInSubgrid, gridGap, videoGridGap]);

    return {
        cellViewsVideoGrid,
        cellViewsInPresentationGrid,
        cellViewsInSubgrid,
        videoStage,
        setContainerBounds,
        setClientAspectRatios,
    };
}

export { useGrid };
