import * as React from "react";

import { VideoView, WherebyVideoElement } from "../VideoView";
import { debounce } from "@whereby.com/core";
import { CellView, Bounds, Origin } from "./layout/types";
import { VideoStageLayout } from "./VideoStageLayout";
import { useGrid } from "./useGrid";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Grid({ renderParticipant }: GridProps) {
    const gridRef = React.useRef<HTMLDivElement>(null);

    const {
        cellViewsVideoGrid,
        cellViewsInPresentationGrid,
        cellViewsInSubgrid,
        videoStage,
        setContainerBounds,
        setClientAspectRatios,
    } = useGrid({ activeVideosSubgridTrigger: 12, stageParticipantLimit: 1, forceSubgrid: true });

    const presentationGridContent = React.useMemo(
        () =>
            cellViewsInPresentationGrid.map((cellView) =>
                renderCellView({
                    cellView,
                    onSetClientAspectRatio: ({ aspectRatio, clientId }) =>
                        setClientAspectRatios((prev) => ({
                            ...prev,
                            [clientId]: aspectRatio,
                        })),
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
                        setClientAspectRatios((prev) => ({
                            ...prev,
                            [clientId]: aspectRatio,
                        })),
                }),
            ),
        [cellViewsVideoGrid],
    );

    const subgridContent = React.useMemo(
        () =>
            cellViewsInSubgrid.map((cellView) =>
                renderCellView({
                    cellView,
                    onSetClientAspectRatio: ({ aspectRatio, clientId }) =>
                        setClientAspectRatios((prev) => ({
                            ...prev,
                            [clientId]: aspectRatio,
                        })),
                }),
            ),
        [cellViewsInSubgrid],
    );

    // Calculate container frame on resize
    React.useEffect(() => {
        if (!gridRef.current) {
            return;
        }

        const resizeObserver = new ResizeObserver(
            debounce(
                () => {
                    setContainerBounds({
                        width: gridRef.current?.clientWidth ?? 640,
                        height: gridRef.current?.clientHeight ?? 480,
                    });
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
            <VideoStageLayout
                layoutVideoStage={videoStage!}
                presentationGridContent={presentationGridContent}
                gridContent={gridContent}
                subgridContent={subgridContent}
            />
        </div>
    );
}

export { Grid };
