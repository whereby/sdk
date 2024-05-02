import * as React from "react";
import { selectClientViewsInGrid, selectClientViewsInPresentationGrid, selectClientViewsInSubgrid } from "./selector";
import { makeFrame } from "./layout/helpers";
import { calculateLayout } from "./layout/stageLayout";
import { useAppSelector } from "../Provider/hooks";
import { makeVideoCellView } from "./layout/cellView";

function useGrid() {
    const [containerBounds, setContainerBounds] = React.useState({ width: 0, height: 0 });
    const [clientAspectRatios, setClientAspectRatios] = React.useState<{ [key: string]: number }>({});
    const clientViewsInGrid = useAppSelector(selectClientViewsInGrid);
    const clientViewsInPresentationGrid = useAppSelector(selectClientViewsInPresentationGrid);
    const clientViewsInSubgrid = useAppSelector(selectClientViewsInSubgrid);

    const cellViewsVideoGrid = React.useMemo(() => {
        return clientViewsInGrid.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: 10,
            });
        });
    }, [clientViewsInGrid, clientAspectRatios]);

    const cellViewsInPresentationGrid = React.useMemo(() => {
        return clientViewsInPresentationGrid.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: 0,
            });
        });
    }, [clientViewsInPresentationGrid, clientAspectRatios]);

    const cellViewsInSubgrid = React.useMemo(() => {
        return clientViewsInSubgrid.map((client) => {
            return makeVideoCellView({
                client,
                aspectRatio: clientAspectRatios[client.id],
                avatarSize: 0,
                cellPaddings: 0,
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
            gridGap: 8,
            isConstrained: false,
            roomBounds: containerFrame.bounds,
            videos: cellViewsVideoGrid,
            videoGridGap: 0,
            presentationVideos: cellViewsInPresentationGrid,
            subgridVideos: cellViewsInSubgrid,
        });
    }, [containerFrame, cellViewsVideoGrid, cellViewsInPresentationGrid, cellViewsInSubgrid]);

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
