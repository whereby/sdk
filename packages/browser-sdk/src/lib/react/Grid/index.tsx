import * as React from "react";

import { VideoView, VideoViewProps, WherebyVideoElement } from "../VideoView";
import { ClientView, debounce } from "@whereby.com/core";
import { CellView } from "./layout/types";
import { VideoStageLayout } from "./VideoStageLayout";
import { useGrid } from "./useGrid";
import { VideoMutedIndicator } from "./VideoMutedIndicator";
import { DefaultParticipantMenu } from "./DefaultParticipantMenu";
import { GridCellContext, GridContext, useGridCell } from "./GridContext";

type GridCellSelfProps = {
    participant: ClientView;
};

type GridCellProps = GridCellSelfProps & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

const GridCell = React.forwardRef<HTMLDivElement, GridCellProps>(({ className, participant, children }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);

    const handleMouseEnter = React.useCallback(() => {
        setIsHovered(true);
    }, []);

    const handleMouseLeave = React.useCallback(() => {
        setIsHovered(false);
    }, []);

    return (
        <GridCellContext.Provider value={{ participant, isHovered }}>
            <div
                ref={ref}
                className={className}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{ height: "100%", width: "100%" }}
            >
                {children}
            </div>
        </GridCellContext.Provider>
    );
});

GridCell.displayName = "GridCell";

type GridVideoViewProps = Omit<VideoViewProps, "stream" | "ref"> & {
    stream?: MediaStream;
};

const GridVideoView = React.forwardRef<WherebyVideoElement, GridVideoViewProps>(({ stream, style, ...rest }, ref) => {
    const videoEl = React.useRef<WherebyVideoElement>(null);
    const { onSetClientAspectRatio, clientAspectRatios, participant, isConstrained } = useGridCell();
    if (!participant) return null;
    const aspectRatio = clientAspectRatios[participant.id];

    React.useImperativeHandle(ref, () => {
        return videoEl.current!;
    });

    const handleResize = React.useCallback(() => {
        const ar = videoEl.current && videoEl.current.captureAspectRatio();

        if (ar && ar !== aspectRatio && participant.id) {
            onSetClientAspectRatio({ aspectRatio: ar, clientId: participant.id });
        }
    }, [clientAspectRatios, participant.id, onSetClientAspectRatio]);

    const s = stream || participant.stream;

    if (!s || !participant.isVideoEnabled) {
        return (
            <VideoMutedIndicator
                isSmallCell={false}
                displayName={participant?.displayName || "Guest"}
                withRoundedCorners
                muted={participant.isLocalClient}
                stream={participant.stream}
            />
        );
    }

    return (
        <VideoView
            ref={videoEl}
            style={{
                borderRadius: isConstrained ? 0 : "8px",
                ...(isConstrained ? { objectFit: "cover" } : {}),
                ...style,
            }}
            muted={participant.isLocalClient}
            {...rest}
            stream={s}
            onVideoResize={handleResize}
        />
    );
});

GridVideoView.displayName = "GridVideoView";

interface RenderCellViewProps {
    cellView: CellView;
    enableParticipantMenu?: boolean;
    render?: ({ participant }: { participant: ClientView }) => React.ReactNode;
}

function renderCellView({ cellView, enableParticipantMenu, render }: RenderCellViewProps) {
    const participant = cellView?.client;

    if (!participant) {
        return undefined;
    }

    switch (cellView.type) {
        case "video":
            return (
                <GridCell participant={participant}>
                    <>
                        {render ? (
                            render({ participant })
                        ) : (
                            <>
                                <GridVideoView />
                                {enableParticipantMenu ? <DefaultParticipantMenu participant={participant} /> : null}
                            </>
                        )}
                    </>
                </GridCell>
            );
    }
}

interface GridProps {
    renderParticipant?: ({ participant }: { participant: ClientView }) => React.ReactNode;
    renderFloatingParticipant?: ({ participant }: { participant: ClientView }) => React.ReactNode;
    gridGap?: number;
    videoGridGap?: number;
    enableSubgrid?: boolean;
    stageParticipantLimit?: number;
    enableParticipantMenu?: boolean;
    enableConstrainedGrid?: boolean;
}

function Grid({
    renderParticipant,
    renderFloatingParticipant,
    stageParticipantLimit,
    gridGap,
    videoGridGap,
    enableSubgrid,
    enableParticipantMenu,
    enableConstrainedGrid,
}: GridProps) {
    const gridRef = React.useRef<HTMLDivElement>(null);

    const {
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
        isConstrained,
        floatingParticipant,
        setFloatingParticipant,
    } = useGrid({
        activeVideosSubgridTrigger: 12,
        stageParticipantLimit,
        gridGap,
        videoGridGap,
        enableSubgrid,
        enableConstrainedGrid,
    });

    const handleSetClientAspectRatio = React.useCallback(
        ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => {
            setClientAspectRatios((prev) => ({
                ...prev,
                [clientId]: aspectRatio,
            }));
        },
        [setClientAspectRatios],
    );

    const floatingContent = React.useMemo(() => {
        return renderCellView({
            cellView: cellViewsFloating[0],
            enableParticipantMenu,
            ...(renderFloatingParticipant
                ? { render: ({ participant }) => renderFloatingParticipant({ participant }) }
                : {}),
        });
    }, [cellViewsFloating]);

    const presentationGridContent = React.useMemo(
        () =>
            cellViewsInPresentationGrid.map((cellView) =>
                renderCellView({
                    cellView,
                    enableParticipantMenu,
                    ...(renderParticipant ? { render: ({ participant }) => renderParticipant({ participant }) } : {}),
                }),
            ),
        [cellViewsInPresentationGrid],
    );

    const gridContent = React.useMemo(
        () =>
            cellViewsVideoGrid.map((cellView) =>
                renderCellView({
                    cellView,
                    enableParticipantMenu,
                    ...(renderParticipant ? { render: ({ participant }) => renderParticipant({ participant }) } : {}),
                }),
            ),
        [cellViewsVideoGrid],
    );

    const subgridContent = React.useMemo(
        () =>
            cellViewsInSubgrid.map((cellView) =>
                renderCellView({
                    cellView,
                    enableParticipantMenu,
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
        <GridContext.Provider
            value={{
                onSetClientAspectRatio: handleSetClientAspectRatio,
                cellViewsVideoGrid,
                cellViewsInPresentationGrid,
                cellViewsInSubgrid,
                clientAspectRatios,
                maximizedParticipant,
                setMaximizedParticipant,
                floatingParticipant,
                setFloatingParticipant,
                isConstrained,
            }}
        >
            <div
                ref={gridRef}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                }}
            >
                <VideoStageLayout
                    containerFrame={containerFrame}
                    floatingContent={floatingContent}
                    layoutVideoStage={videoStage!}
                    presentationGridContent={presentationGridContent}
                    gridContent={gridContent}
                    subgridContent={subgridContent}
                />
            </div>
        </GridContext.Provider>
    );
}

export { Grid, GridCell, GridVideoView, useGridCell };
