import * as React from "react";
import type {
    LocalParticipantState as LocalParticipant,
    RemoteParticipantState as RemoteParticipant,
} from "../useRoomConnection/types";
import VideoView from "../VideoView";
import {
    doRtcReportStreamResolution,
    observeStore,
    setAspectRatio,
    debounce,
    setContainerBounds,
    Bounds,
    Origin,
    ResultCellView,
} from "@whereby.com/core";
import { selectVideoGridState, VideoGridState } from "./selector";
import { WherebyContext } from "../Provider";

function GridVideoCellView({
    cell,
    participant,
    render,
    onSetAspectRatio,
    onResize,
}: {
    cell: ResultCellView;
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
    cellViewsVideoGrid: [],
    localParticipant: undefined,
    remoteParticipants: [],
    videoStage: undefined,
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

    const { remoteParticipants, localParticipant } = videoGridState;
    const participants = [localParticipant, ...remoteParticipants].filter(Boolean);
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
                const cell = videoGridState.videoStage?.videoGrid.cells[i];

                if (!cell || !participant || !participant.stream || !cell.clientId) return null;

                return (
                    <GridVideoCellView
                        key={cell.clientId}
                        cell={cell}
                        participant={participant}
                        render={renderParticipant ? () => renderParticipant({ cell, participant }) : undefined}
                        onResize={handleResize}
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
