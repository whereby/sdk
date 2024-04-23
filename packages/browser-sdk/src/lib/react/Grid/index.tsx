import * as React from "react";

import { VideoView, WherebyVideoElement } from "../VideoView";
import {
    setAspectRatio,
    debounce,
    setContainerBounds,
    Bounds,
    Origin,
    CellView,
    observeStore,
    makeBounds,
    makeOrigin,
} from "@whereby.com/core";
import { VideoGridState, selectVideoGridState } from "./selector";
import { WherebyContext } from "../Provider";
import { VideoStageLayout } from "./VideoStageLayout";

interface RenderCellViewProps {
    cellView: CellView;
    onSetClientAspectRatio: ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => void;
}

function renderCellView({ cellView, onSetClientAspectRatio }: RenderCellViewProps) {
    switch (cellView.type) {
        case "video":
            return (
                <GridVideoCellView
                    aspectRatio={cellView.aspectRatio}
                    participant={cellView.client}
                    isPlaceholder={cellView.isPlaceholder}
                    isSubgrid={cellView.isSubgrid}
                    key={cellView.clientId}
                    onSetClientAspectRatio={onSetClientAspectRatio}
                />
            );
    }
}

interface GridVideoCellViewProps {
    aspectRatio?: number;
    participant: CellView["client"];
    isPlaceholder?: boolean;
    isSubgrid?: boolean;
    render?: () => React.ReactNode;
    onSetClientAspectRatio: ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => void;
}

function GridVideoCellView({ aspectRatio, participant, render, onSetClientAspectRatio }: GridVideoCellViewProps) {
    const videoEl = React.useRef<WherebyVideoElement>(null);

    const handleResize = React.useCallback(() => {
        const ar = videoEl.current && videoEl.current.captureAspectRatio();

        if (ar && ar !== aspectRatio && participant?.id) {
            onSetClientAspectRatio({ aspectRatio: ar, clientId: participant.id });
        }
    }, []);

    return (
        <div>
            {render ? (
                render()
            ) : participant?.stream ? (
                <VideoView
                    ref={videoEl}
                    stream={participant.stream}
                    onVideoResize={handleResize}
                    style={{
                        borderRadius: "8px",
                    }}
                />
            ) : null}
        </div>
    );
}

interface GridProps {
    renderParticipant?: ({
        cell,
        participant,
    }: {
        cell: { clientId: string; bounds: Bounds; origin: Origin };
        participant: CellView["client"];
    }) => React.ReactNode;
    videoGridGap?: number;
}

const initialState: VideoGridState = {
    videoStage: null,
    cellViewsVideoGrid: [],
    cellViewsInPresentationGrid: [],
    containerFrame: { bounds: makeBounds(), origin: makeOrigin() },
};

function Grid({ renderParticipant }: GridProps) {
    const store = React.useContext(WherebyContext);
    const gridRef = React.useRef<HTMLDivElement>(null);

    if (!store) {
        throw new Error("VideoView must be used within a WherebyProvider");
    }

    const [videoGridState, setVideoViewState] = React.useState(initialState);

    React.useEffect(() => {
        const unsubscribe = observeStore(store, selectVideoGridState, setVideoViewState);

        return () => {
            unsubscribe();
        };
    }, [store]);

    const { cellViewsVideoGrid, cellViewsInPresentationGrid } = videoGridState;

    const presentationGridContent = React.useMemo(
        () =>
            cellViewsInPresentationGrid.map((cellView) =>
                renderCellView({
                    cellView,
                    onSetClientAspectRatio: ({ aspectRatio, clientId }) =>
                        store.dispatch(setAspectRatio({ clientId, aspectRatio })),
                }),
            ),
        [cellViewsInPresentationGrid],
    );

    const gridContent = React.useMemo(
        () =>
            cellViewsVideoGrid.map((cellView) =>
                renderCellView({
                    cellView,
                    onSetClientAspectRatio: ({ aspectRatio, clientId }) =>
                        store.dispatch(setAspectRatio({ clientId, aspectRatio })),
                }),
            ),
        [cellViewsVideoGrid],
    );

    // Calculate container frame on resize
    React.useEffect(() => {
        if (!gridRef.current) {
            return;
        }

        const resizeObserver = new ResizeObserver(
            debounce(
                () => {
                    store.dispatch(
                        setContainerBounds({
                            width: gridRef.current?.clientWidth || 0,
                            height: gridRef.current?.clientHeight || 0,
                        }),
                    );
                },
                { delay: 60, edges: false },
            ),
        );
        resizeObserver.observe(gridRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    React.useEffect(() => {
        console.log(videoGridState.videoStage);
    }, [videoGridState.videoStage]);

    return (
        <div
            ref={gridRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
            }}
        >
            <VideoStageLayout
                layoutVideoStage={videoGridState.videoStage!}
                presentationGridContent={presentationGridContent}
                gridContent={gridContent}
                frame={videoGridState.containerFrame}
            />
        </div>
    );
}

export { Grid };
