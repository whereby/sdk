import * as React from "react";

import cn from "clsx";
import { VideoView, VideoViewProps, WherebyVideoElement } from "../VideoView";
import { ClientView, debounce, selectSpotlightedClientViews } from "@whereby.com/core";
import { CellView } from "./layout/types";
import { VideoStageLayout } from "./VideoStageLayout";
import { useGrid } from "./useGrid";
import { VideoMutedIndicator } from "./VideoMutedIndicator";
import {
    ParticipantMenu,
    ParticipantMenuContent,
    ParticipantMenuItem,
    ParticipantMenuTrigger,
} from "./ParticipantMenu";
import { EllipsisIcon } from "../../EllipsisIcon";
import { useAppSelector } from "../Provider/hooks";
import { MaximizeOnIcon } from "../../MaximizeOnIcon";
import { SpotlightIcon } from "../../SpotlightIcon";

interface DefaultParticipantMenuProps {
    participant: ClientView;
}

const DefaultParticipantMenu = ({ participant }: DefaultParticipantMenuProps) => {
    const spotlightedParticipants = useAppSelector(selectSpotlightedClientViews);
    const isSpotlighted = spotlightedParticipants.find((p) => p.id === participant.id);
    const { isHovered } = useGridCell();

    if (!isHovered) {
        return null;
    }

    return (
        <ParticipantMenu>
            <ParticipantMenuTrigger
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#fff",
                    borderRadius: "6px",
                    padding: "4px",
                }}
            >
                <EllipsisIcon height={20} width={20} transform={"rotate(90)"} />
            </ParticipantMenuTrigger>
            <ParticipantMenuContent>
                <ParticipantMenuItem
                    participantAction={"maximize"}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <MaximizeOnIcon height={16} width={16} />
                    Maximize
                </ParticipantMenuItem>
                <ParticipantMenuItem
                    participantAction={"spotlight"}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <SpotlightIcon height={16} width={16} />
                    {isSpotlighted ? "Remove spotlight" : "Spotlight"}
                </ParticipantMenuItem>
            </ParticipantMenuContent>
        </ParticipantMenu>
    );
};

type GridCellContextValue = {
    participant: ClientView;
    isHovered: boolean;
};

const GridCellContext = React.createContext<GridCellContextValue>({} as GridCellContextValue);

const useGridCell = () => {
    const gridContext = React.useContext(GridContext);
    const gridVideoViewContext = React.useContext(GridCellContext);

    if (!gridVideoViewContext) {
        throw new Error("useGridVideoView must be used within a GridVideoView");
    }

    return {
        ...gridContext,
        ...gridVideoViewContext,
    };
};

type GridCellSelfProps = {
    participant: ClientView;
};

type GridCellProps = GridCellSelfProps & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

const GridCell = React.forwardRef<HTMLDivElement, GridCellProps>(({ className, participant, ...rest }, ref) => {
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
                className={cn("gridCell", className)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...rest}
            />
        </GridCellContext.Provider>
    );
});

GridCell.displayName = "GridCell";

type GridVideoViewProps = Omit<VideoViewProps, "stream" | "ref"> & {
    stream?: MediaStream;
};

const GridVideoView = React.forwardRef<WherebyVideoElement, GridVideoViewProps>(
    ({ className, stream, ...rest }, ref) => {
        const videoEl = React.useRef<WherebyVideoElement>(null);
        const { onSetClientAspectRatio, clientAspectRatios, participant } = useGridCell();
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

        if (!s) {
            return null;
        }

        return (
            <VideoView ref={videoEl} className={cn("", className)} {...rest} stream={s} onVideoResize={handleResize} />
        );
    },
);

GridVideoView.displayName = "GridVideoView";

interface RenderCellViewProps {
    cellView: CellView;
    enableParticipantMenu?: boolean;
    render?: ({ participant }: { participant: ClientView }) => React.ReactNode;
}

function renderCellView({ cellView, enableParticipantMenu, render }: RenderCellViewProps) {
    const participant = cellView.client;

    if (!participant) {
        return undefined;
    }

    switch (cellView.type) {
        case "video":
            return (
                <GridCell participant={participant}>
                    {participant.isVideoEnabled ? (
                        <>
                            {render ? (
                                render({ participant })
                            ) : (
                                <>
                                    <GridVideoView />
                                    {enableParticipantMenu ? (
                                        <DefaultParticipantMenu participant={participant} />
                                    ) : null}
                                </>
                            )}
                        </>
                    ) : (
                        <VideoMutedIndicator
                            isSmallCell={false}
                            displayName={participant?.displayName || "Guest"}
                            withRoundedCorners
                        />
                    )}
                </GridCell>
            );
    }
}

type GridContextValue = {
    onSetClientAspectRatio: ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => void;
    cellViewsVideoGrid: CellView[];
    cellViewsInPresentationGrid: CellView[];
    cellViewsInSubgrid: CellView[];
    clientAspectRatios: { [key: string]: number };
};

const GridContext = React.createContext<GridContextValue>({} as GridContextValue);

interface GridProps {
    renderParticipant?: ({ participant }: { participant: ClientView }) => React.ReactNode;
    gridGap?: number;
    videoGridGap?: number;
    enableSubgrid?: boolean;
    stageParticipantLimit?: number;
    enableParticipantMenu?: boolean;
}

function Grid({
    renderParticipant,
    stageParticipantLimit,
    gridGap,
    videoGridGap,
    enableSubgrid,
    enableParticipantMenu,
}: GridProps) {
    const gridRef = React.useRef<HTMLDivElement>(null);

    const {
        cellViewsVideoGrid,
        cellViewsInPresentationGrid,
        cellViewsInSubgrid,
        clientAspectRatios,
        videoStage,
        setContainerBounds,
        setClientAspectRatios,
        maximizedParticipant,
        setMaximizedParticipant,
    } = useGrid({ activeVideosSubgridTrigger: 12, stageParticipantLimit, gridGap, videoGridGap, enableSubgrid });

    const handleSetClientAspectRatio = React.useCallback(
        ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => {
            setClientAspectRatios((prev) => ({
                ...prev,
                [clientId]: aspectRatio,
            }));
        },
        [setClientAspectRatios],
    );

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
