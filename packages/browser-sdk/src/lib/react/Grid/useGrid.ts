import * as React from "react";
import { selectVideoGridState } from "./selector";
import { makeFrame } from "./layout/helpers";
import { calculateLayout } from "./layout/stageLayout";
import { useAppSelector } from "../Provider/hooks";

function useGrid() {
    const [containerBounds, setContainerBounds] = React.useState({ width: 0, height: 0 });
    const videoGridState = useAppSelector(selectVideoGridState);

    const { cellViewsVideoGrid, cellViewsInPresentationGrid, cellViewsInSubgrid } = videoGridState;

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
    };
}

export { useGrid };
