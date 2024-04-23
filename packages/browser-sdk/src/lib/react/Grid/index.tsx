import * as React from "react";
import type {
    LocalParticipantState as LocalParticipant,
    RemoteParticipantState as RemoteParticipant,
} from "../useRoomConnection/types";
import { VideoView, WherebyVideoElement } from "../VideoView";
import {
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
}: {
    cell: ResultCellView;
    participant: RemoteParticipant | LocalParticipant;
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
            ) : participant.stream ? (
                <VideoView ref={videoEl} stream={participant.stream} onVideoResize={handleResize} />
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
