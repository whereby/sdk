import * as React from "react";

import { VideoView, WherebyVideoElement } from "../VideoView";
import {
    observeStore,
    setAspectRatio,
    debounce,
    setContainerBounds,
    Bounds,
    Origin,
    ResultCellView,
    CellView,
} from "@whereby.com/core";
import { selectVideoGridState, VideoGridState } from "./selector";
import { WherebyContext } from "../Provider";

function GridVideoCellView({
    cell,
    cellView,
    render,
    onSetAspectRatio,
}: {
    cell: ResultCellView;
    cellView: CellView;
    render?: () => React.ReactNode;
    onSetAspectRatio: ({ aspectRatio }: { aspectRatio: number }) => void;
}) {
    const videoEl = React.useRef<WherebyVideoElement>(null);

    const handleResize = React.useCallback(() => {
        const ar = videoEl.current && videoEl.current.captureAspectRatio();

        if (ar && ar !== cell.aspectRatio) {
            onSetAspectRatio({ aspectRatio: ar });
        }
    }, []);

    return (
        <div
            style={{
                position: "absolute",
                width: cell.bounds.width,
                height: cell.bounds.height,
                boxSizing: "border-box",
                top: cell.origin.top,
                left: cell.origin.left,
            }}
        >
            {render ? (
                render()
            ) : cellView.client?.stream ? (
                <VideoView ref={videoEl} stream={cellView.client.stream} onVideoResize={handleResize} />
            ) : null}
        </div>
    );
}

const initialState: VideoGridState = {
    cellViewsVideoGrid: [],
    cellViewsInPresentationGrid: [],
    videoStage: undefined,
};

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

function Grid({ renderParticipant }: GridProps) {
    const store = React.useContext(WherebyContext);

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
    const allCellViews = [...cellViewsVideoGrid, ...cellViewsInPresentationGrid].filter(Boolean);
    const gridRef = React.useRef<HTMLDivElement>(null);

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

    return (
        <div
            ref={gridRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
            }}
        >
            {allCellViews.map((cellView, i) => {
                const cell = videoGridState.videoStage?.videoGrid.cells[i];

                if (!cell || !cellView || !cellView.client?.stream || !cell.clientId) return null;

                return (
                    <GridVideoCellView
                        key={cell.clientId}
                        cell={cell}
                        cellView={cellView}
                        render={
                            renderParticipant
                                ? () => renderParticipant({ cell, participant: cellView.client })
                                : undefined
                        }
                        onSetAspectRatio={({ aspectRatio }) => {
                            store.dispatch(setAspectRatio({ clientId: cell.clientId, aspectRatio }));
                        }}
                    />
                );
            })}
        </div>
    );
}

export { Grid };
