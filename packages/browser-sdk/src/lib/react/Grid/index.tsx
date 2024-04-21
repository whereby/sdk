import * as React from "react";
import type {
    LocalParticipantState as LocalParticipant,
    RemoteParticipantState as RemoteParticipant,
} from "../useRoomConnection/types";
import VideoView from "../VideoView";
import { calculateLayout } from "./helpers/stageLayout";
import { Bounds, Frame, Origin, makeFrame } from "./helpers/layout";
import { makeVideoCellView } from "./helpers/cellView";
import { doRtcReportStreamResolution, observeStore } from "@whereby.com/core";
import { debounce } from "@whereby.com/core";
import { selectVideoGridState, VideoGridState } from "./selector";
import { WherebyContext } from "../Provider";

function GridVideoCellView({
    cell,
    participant,
    render,
    onSetAspectRatio,
    onResize,
}: {
    cell: { aspectRatio: number; clientId: string; bounds: Bounds; origin: Origin };
    participant: RemoteParticipant | LocalParticipant;
    render?: () => React.ReactNode;
    onSetAspectRatio: ({ aspectRatio }: { aspectRatio: number }) => void;
    onResize?: ({ width, height, stream }: { width: number; height: number; stream: MediaStream }) => void;
}) {
    const handleAspectRatioChange = React.useCallback(
        ({ ar }: { ar: number }) => {
            if (ar !== cell.aspectRatio) {
                onSetAspectRatio({ aspectRatio: ar });
            }
        },
        [cell.aspectRatio, onSetAspectRatio],
    );

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
            ) : participant.stream ? (
                <VideoView
                    stream={participant.stream}
                    onSetAspectRatio={({ aspectRatio }) => handleAspectRatioChange({ ar: aspectRatio })}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onResize={onResize as any}
                />
            ) : null}
        </div>
    );
}

const initialState: VideoGridState = {
    localParticipant: undefined,
    remoteParticipants: [],
};

interface GridProps {
    renderParticipant?: ({
        cell,
        participant,
    }: {
        cell: { clientId: string; bounds: Bounds; origin: Origin };
        participant: RemoteParticipant | LocalParticipant;
    }) => React.ReactNode;
    videoGridGap?: number;
}

function Grid({ renderParticipant, videoGridGap = 0 }: GridProps) {
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

    const { remoteParticipants, localParticipant } = videoGridState;
    const gridRef = React.useRef<HTMLDivElement>(null);
    const [containerFrame, setContainerFrame] = React.useState<Frame | null>(null);
    const [aspectRatios, setAspectRatios] = React.useState<{ clientId: string; aspectRatio: number }[]>([]);

    // Calculate container frame on resize
    React.useEffect(() => {
        if (!gridRef.current) {
            return;
        }

        const resizeObserver = new ResizeObserver(
            debounce(
                () => {
                    setContainerFrame(
                        makeFrame({
                            width: gridRef.current?.clientWidth,
                            height: gridRef.current?.clientHeight,
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

    // Merge local and remote participants
    const participants = React.useMemo(() => {
        return [...(localParticipant ? [localParticipant] : []), ...remoteParticipants];
    }, [remoteParticipants, localParticipant]);

    // Make video cells
    const videoCells = React.useMemo(() => {
        return participants.map((participant) => {
            const aspectRatio = aspectRatios.find((item) => item.clientId === participant?.id)?.aspectRatio;

            return makeVideoCellView({
                aspectRatio: aspectRatio ?? 16 / 9,
                avatarSize: 0,
                cellPaddings: 10,
                client: { id: participant?.id },
            });
        });
    }, [participants, aspectRatios]);

    // Calculate stage layout
    const stageLayout = React.useMemo(() => {
        if (!containerFrame) return null;

        return calculateLayout({
            frame: containerFrame,
            gridGap: 0,
            isConstrained: false,
            roomBounds: containerFrame.bounds,
            videos: videoCells,
            videoGridGap,
        });
    }, [containerFrame, videoCells, videoGridGap]);

    // Handle resize
    const handleResize = React.useCallback(
        ({ width, height, stream }: { width: number; height: number; stream: MediaStream }) => {
            store.dispatch(doRtcReportStreamResolution({ streamId: stream.id, width, height }));
        },
        [localParticipant, store],
    );

    return (
        <div
            ref={gridRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
            }}
        >
            {participants.map((participant, i) => {
                const cell = stageLayout?.videoGrid.cells[i];

                if (!cell || !participant || !participant.stream || !cell.clientId) return null;

                return (
                    <GridVideoCellView
                        key={cell.clientId}
                        cell={cell}
                        participant={participant}
                        render={renderParticipant ? () => renderParticipant({ cell, participant }) : undefined}
                        onResize={handleResize}
                        onSetAspectRatio={({ aspectRatio }) => {
                            setAspectRatios((prev) => {
                                const index = prev.findIndex((item) => item.clientId === cell.clientId);

                                if (index === -1) {
                                    return [...prev, { clientId: cell.clientId, aspectRatio }];
                                }

                                return [
                                    ...prev.slice(0, index),
                                    { clientId: cell.clientId, aspectRatio },
                                    ...prev.slice(index + 1),
                                ];
                            });
                        }}
                    />
                );
            })}
        </div>
    );
}

export { Grid };
