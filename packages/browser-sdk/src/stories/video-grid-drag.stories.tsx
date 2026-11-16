import * as React from "react";

import { StoryObj } from "@storybook/react-vite";
import "./styles.css";
import { useRoomConnection } from "../lib/react";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import { Grid as VideoGrid, GridVideoView, useGridCell } from "../lib/react/Grid";
import {
    ParticipantMenu,
    ParticipantMenuContent,
    ParticipantMenuItem,
    ParticipantMenuTrigger,
} from "../lib/react/Grid/ParticipantMenu";
import { FakeParticipantsProvider } from "./components/FakeGridClient";

const meta: StoryObj = {
    name: "Examples/Video Grid Drag to Reorder",
    argTypes: {
        displayName: { control: "text" },
        roomUrl: { control: "text", type: { required: true } },
        roomKey: { control: "text" },
    },
    args: {
        displayName: "SDK",
        roomUrl: process.env.STORYBOOK_ROOM,
        roomKey: process.env.STORYBOOK_ROOM_HOST_ROOMKEY || "",
    },
    decorators: [
        (Story) => (
            <WherebyProvider>
                <Story />
            </WherebyProvider>
        ),
    ],
};

export default meta;

const roomRegEx = new RegExp(/^https:\/\/.*\/.*/);

const DRAG_TYPE = "application/x-whereby-cell-id";

function cellIdAt(target: EventTarget | null) {
    return target instanceof Element ? target.closest("[data-cell-id]")?.getAttribute("data-cell-id") : null;
}

function DraggableTile({ isSubgrid = false }: { isSubgrid?: boolean }) {
    const { participant, moveCell, maximizedCellId } = useGridCell();

    return (
        <div className={isSubgrid ? "subgridCell" : "gridCell"} style={{ width: "100%", height: "100%" }}>
            <div
                className="draggableTile"
                draggable
                onDragStart={(event) => {
                    const cellId = cellIdAt(event.currentTarget);
                    if (!cellId) {
                        event.preventDefault();
                        return;
                    }
                    event.dataTransfer.setData(DRAG_TYPE, cellId);
                    event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                    if (event.dataTransfer.types.includes(DRAG_TYPE)) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    const draggedId = event.dataTransfer.getData(DRAG_TYPE);
                    const targetId = cellIdAt(event.target);
                    if (draggedId && targetId) {
                        moveCell(draggedId, targetId);
                    }
                }}
            >
                <GridVideoView className="videoView" />
                <div className={isSubgrid ? "subgridCellName" : "gridCellName"}>{participant.displayName}</div>
            </div>
            {!isSubgrid && (
                <ParticipantMenu>
                    <ParticipantMenuTrigger className="participantMenuTrigger">Actions</ParticipantMenuTrigger>
                    <ParticipantMenuContent className="participantMenuContent">
                        <ParticipantMenuItem className="participantMenuItem" participantAction="maximize">
                            {maximizedCellId === participant.id ? "Minimize" : "Maximize"}
                        </ParticipantMenuItem>
                        <ParticipantMenuItem className="participantMenuItem" participantAction="spotlight">
                            Spotlight
                        </ParticipantMenuItem>
                    </ParticipantMenuContent>
                </ParticipantMenu>
            )}
        </div>
    );
}

function DraggableGrid() {
    return (
        <div style={{ height: "500px", width: "100%" }}>
            <VideoGrid
                renderParticipant={() => <DraggableTile />}
                renderSubgridParticipant={() => <DraggableTile isSubgrid />}
            />
        </div>
    );
}

function RoomWithDraggableGrid({
    roomUrl,
    displayName,
    roomKey,
}: {
    roomUrl: string;
    displayName?: string;
    roomKey?: string;
}) {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const {
        state: { connectionStatus },
        actions: { joinRoom, leaveRoom },
    } = useRoomConnection(roomUrl, {
        localMediaOptions: { audio: false, video: true },
        displayName,
        ...(roomKey ? { roomKey } : {}),
    });

    React.useEffect(() => {
        // Storybook mounts stories twice; joining from the unattached mount breaks video
        if (!rootRef.current?.isConnected) {
            return;
        }
        joinRoom();
        return () => leaveRoom();
    }, []);

    return (
        <div ref={rootRef}>
            <div className="controls">
                <span>Connection status: {connectionStatus}</span>
            </div>
            <DraggableGrid />
        </div>
    );
}

export const DragToReorder = {
    render: ({ roomUrl, displayName, roomKey }: { roomUrl: string; displayName?: string; roomKey?: string }) => {
        if (!roomUrl || !roomUrl.match(roomRegEx)) {
            return <p>Set room url on the Controls panel</p>;
        }

        return <RoomWithDraggableGrid roomUrl={roomUrl} displayName={displayName} roomKey={roomKey} />;
    },
};

export const DragToReorderMocked = {
    render: ({ numParticipants, numVideosOff }: { numParticipants: number; numVideosOff: number }) => (
        <FakeParticipantsProvider numParticipants={numParticipants} numVideosOff={numVideosOff}>
            <DraggableGrid />
        </FakeParticipantsProvider>
    ),
    argTypes: {
        numParticipants: { control: { type: "range", min: 1, max: 30, step: 1 } },
        numVideosOff: { control: { type: "range", min: 0, max: 30, step: 1 } },
        displayName: { table: { disable: true } },
        roomUrl: { table: { disable: true } },
        roomKey: { table: { disable: true } },
    },
    args: {
        numParticipants: 6,
        numVideosOff: 0,
    },
};
