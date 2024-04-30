import * as React from "react";
import { WherebyContext } from "../Provider";
import { observeStore } from "@whereby.com/core";
import { VideoGridState, selectVideoGridState } from "./selector";
import { makeFrame } from "./layout/helpers";
import { calculateLayout } from "./layout/stageLayout";

const initialState: VideoGridState = {
    cellViewsVideoGrid: [],
    cellViewsInPresentationGrid: [],
    cellViewsInSubgrid: [],
};

function useGrid() {
    const store = React.useContext(WherebyContext);
    const [videoGridState, setVideoViewState] = React.useState(initialState);
    const [containerBounds, setContainerBounds] = React.useState({ width: 0, height: 0 });

    if (!store) {
        throw new Error("useGrid must be used within a WherebyProvider");
    }

    React.useEffect(() => {
        const unsubscribe = observeStore(store, selectVideoGridState, setVideoViewState);

        return () => {
            unsubscribe();
        };
    }, [store]);

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
        store,
        cellViewsVideoGrid,
        cellViewsInPresentationGrid,
        cellViewsInSubgrid,
        videoStage,
        setContainerBounds,
    };
}

export { useGrid };
