import * as React from "react";

import { VideoView, WherebyVideoElement } from "../VideoView";
import { ClientView, debounce } from "@whereby.com/core";
import { CellView } from "./layout/types";
import { VideoStageLayout } from "./VideoStageLayout";
import { useGrid } from "./useGrid";
import { VideoMutedIndicator } from "./VideoMutedIndicator";

type GridCell = CellView & {
    onSetClientAspectRatio: ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => void;
};

interface GridVideoViewProps {
    cell: GridCell;
}

export function GridVideoView({ cell, ...rest }: GridVideoViewProps) {
    const videoEl = React.useRef<WherebyVideoElement>(null);

    const handleResize = React.useCallback(() => {
        const ar = videoEl.current && videoEl.current.captureAspectRatio();

        if (ar && ar !== cell.aspectRatio && cell.client?.id) {
            cell.onSetClientAspectRatio({ aspectRatio: ar, clientId: cell.client.id });
        }
    }, []);

    if (!cell.client?.stream) {
        return null;
    }

    return <VideoView ref={videoEl} stream={cell.client.stream} {...rest} onVideoResize={handleResize} />;
}

interface RenderCellViewProps {
    cellView: CellView;
    onSetClientAspectRatio: ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => void;
    render?: ({ cell }: { cell: GridCell }) => React.ReactNode;
}

function renderCellView({ cellView, onSetClientAspectRatio, render }: RenderCellViewProps) {
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
                    render={render}
                />
            );
    }
}

interface GridVideoCellViewProps {
    aspectRatio?: number;
    participant: CellView["client"];
    isPlaceholder?: boolean;
    isSubgrid?: boolean;
    render?: ({ cell }: { cell: GridCell }) => React.ReactNode;
    onSetClientAspectRatio: ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => void;
}

function GridVideoCellView({ aspectRatio, participant, onSetClientAspectRatio, render }: GridVideoCellViewProps) {
    const videoEl = React.useRef<WherebyVideoElement>(null);

    const handleResize = React.useCallback(() => {
        const ar = videoEl.current && videoEl.current.captureAspectRatio();

        if (ar && ar !== aspectRatio && participant?.id) {
            onSetClientAspectRatio({ aspectRatio: ar, clientId: participant.id });
        }
    }, []);

    return (
        <div>
            {participant?.stream && participant.isVideoEnabled ? (
                <>
                    {render ? (
                        render()
                    ) : (
                        <VideoView
                            ref={videoEl}
                            stream={participant.stream}
                            onVideoResize={handleResize}
                            style={{
                                borderRadius: "8px",
                            }}
                        />
                    )}
                </>
            ) : (
                <VideoMutedIndicator
                    isSmallCell={false}
                    displayName={participant?.displayName || "Guest"}
                    withRoundedCorners
                />
            )}
        </div>
    );
}

interface GridProps {
    renderParticipant?: ({
        participant,
        children,
    }: {
        participant: CellView["client"];
        children: React.ReactElement<WherebyVideoElement>;
    }) => React.ReactNode;
    gridGap?: number;
    videoGridGap?: number;
    enableSubgrid?: boolean;
    stageParticipantLimit?: number;
}

function Grid({ renderParticipant, stageParticipantLimit, gridGap, videoGridGap, enableSubgrid }: GridProps) {
    const gridRef = React.useRef<HTMLDivElement>(null);

    const {
        cellViewsVideoGrid,
        cellViewsInPresentationGrid,
        cellViewsInSubgrid,
        videoStage,
        setContainerBounds,
        setClientAspectRatios,
    } = useGrid({ activeVideosSubgridTrigger: 12, stageParticipantLimit, gridGap, videoGridGap, enableSubgrid });

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
                    ...(renderParticipant
                        ? { render: ({ children }) => renderParticipant({ participant: cellView.client, children }) }
                        : {}),
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
                    ...(renderParticipant
                        ? { render: ({ children }) => renderParticipant({ participant: cellView.client, children }) }
                        : {}),
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
