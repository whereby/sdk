import * as React from "react";

import { StoryObj } from "@storybook/react-vite";
import "./styles.css";
import { useLocalMedia, useRoomConnection } from "../lib/react";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import { Grid as VideoGrid, GridCell, GridVideoView } from "../lib/react/Grid";
import {
    ParticipantMenu,
    ParticipantMenuContent,
    ParticipantMenuItem,
    ParticipantMenuTrigger,
} from "../lib/react/Grid/ParticipantMenu";
import { FakeParticipantsProvider } from "./components/FakeGridClient";
import PrecallExperience from "./components/PrecallExperience";

const defaultArgs: StoryObj = {
    name: "Examples/Video Grid UI",
    argTypes: {
        displayName: { control: "text" },
        roomUrl: { control: "text", type: { required: true } },
        externalId: { control: "text" },
    },
    args: {
        displayName: "SDK",
        roomUrl: process.env.STORYBOOK_ROOM,
    },
    decorators: [
        (Story) => (
            <WherebyProvider>
                <Story />
            </WherebyProvider>
        ),
    ],
};

export default defaultArgs;

const roomRegEx = new RegExp(/^https:\/\/.*\/.*/);

export const VideoGridStory = {
    render: ({
        roomUrl,
        gridGap,
        videoGridGap,
        enableSubgrid,
        enableParticipantMenu,
        enableConstrainedGrid,
    }: {
        displayName: string;
        roomUrl: string;
        gridGap?: number;
        videoGridGap?: number;
        enableSubgrid?: boolean;
        enableParticipantMenu?: boolean;
        enableConstrainedGrid?: boolean;
    }) => {
        if (!roomUrl || !roomUrl.match(roomRegEx)) {
            return <p>Set room url on the Controls panel</p>;
        }
        const [isLocalScreenshareActive, setIsLocalScreenshareActive] = React.useState(false);
        const [shouldJoin, setShouldJoin] = React.useState(false);

        const { actions } = useRoomConnection(roomUrl, { localMediaOptions: { audio: true, video: true } });
        const { toggleCamera, toggleMicrophone, startScreenshare, stopScreenshare, joinRoom, leaveRoom } = actions;

        const handleToggleJoin = () => {
            if (shouldJoin) {
                leaveRoom();
            } else {
                joinRoom();
            }
            setShouldJoin(!shouldJoin);
        };

        return (
            <>
                <div className="controls">
                    <button onClick={handleToggleJoin}>{shouldJoin ? "Leave room" : "Join room"}</button>
                    <button onClick={() => toggleCamera()}>Toggle camera</button>
                    <button onClick={() => toggleMicrophone()}>Toggle microphone</button>
                    <button
                        onClick={() => {
                            if (isLocalScreenshareActive) {
                                stopScreenshare();
                            } else {
                                startScreenshare();
                            }
                            setIsLocalScreenshareActive((prev) => !prev);
                        }}
                    >
                        Toggle screenshare
                    </button>
                </div>
                <div style={{ height: "500px", width: "100%" }}>
                    <VideoGrid
                        gridGap={gridGap}
                        videoGridGap={videoGridGap}
                        stageParticipantLimit={3}
                        enableSubgrid={enableSubgrid}
                        enableParticipantMenu={enableParticipantMenu}
                        enableConstrainedGrid={enableConstrainedGrid}
                    />
                </div>
            </>
        );
    },
    argTypes: {
        ...defaultArgs.argTypes,
        gridGap: { control: "range", min: 0, max: 100 },
        videoGridGap: { control: "range", min: 0, max: 100 },
        enableSubgrid: { control: "boolean" },
        enableParticipantMenu: { control: "boolean" },
        enableConstrainedGrid: { control: "boolean" },
    },
    args: {
        ...defaultArgs.args,
        gridGap: 8,
        videoGridGap: 8,
        enableSubgrid: true,
        enableParticipantMenu: true,
        enableConstrainedGrid: true,
    },
};

export const VideoGridStoryCustom = {
    render: ({
        roomUrl,
        gridGap,
        videoGridGap,
        enableSubgrid,
    }: {
        displayName: string;
        roomUrl: string;
        gridGap?: number;
        videoGridGap?: number;
        enableSubgrid?: boolean;
    }) => {
        if (!roomUrl || !roomUrl.match(roomRegEx)) {
            return <p>Set room url on the Controls panel</p>;
        }
        const [isLocalScreenshareActive, setIsLocalScreenshareActive] = React.useState(false);
        const [shouldJoin, setShouldJoin] = React.useState(false);

        const { actions } = useRoomConnection(roomUrl, { localMediaOptions: { audio: false, video: true } });
        const { toggleCamera, toggleMicrophone, startScreenshare, stopScreenshare, joinRoom, leaveRoom } = actions;

        const handleToggleJoin = () => {
            if (shouldJoin) {
                leaveRoom();
            } else {
                joinRoom();
            }
            setShouldJoin(!shouldJoin);
        };

        return (
            <>
                <div className="controls">
                    <button onClick={handleToggleJoin}>{shouldJoin ? "Leave room" : "Join room"}</button>
                    <button onClick={() => toggleCamera()}>Toggle camera</button>
                    <button onClick={() => toggleMicrophone()}>Toggle microphone</button>
                    <button
                        onClick={() => {
                            if (isLocalScreenshareActive) {
                                stopScreenshare();
                            } else {
                                startScreenshare();
                            }
                            setIsLocalScreenshareActive((prev) => !prev);
                        }}
                    >
                        Toggle screenshare
                    </button>
                </div>
                <div style={{ height: "500px", width: "100%" }}>
                    <VideoGrid
                        gridGap={gridGap}
                        videoGridGap={videoGridGap}
                        enableSubgrid={enableSubgrid}
                        renderParticipant={({ participant }) => {
                            return (
                                <GridCell className={"gridCell"} participant={participant}>
                                    <GridVideoView className={"videoView"} />
                                    <ParticipantMenu>
                                        <ParticipantMenuTrigger className={"participantMenuTrigger"}>
                                            Actions
                                        </ParticipantMenuTrigger>
                                        <ParticipantMenuContent className={"participantMenuContent"}>
                                            <ParticipantMenuItem
                                                className={"participantMenuItem"}
                                                participantAction={"maximize"}
                                            >
                                                Maximize
                                            </ParticipantMenuItem>
                                            <ParticipantMenuItem
                                                className={"participantMenuItem"}
                                                participantAction={"spotlight"}
                                            >
                                                Spotlight
                                            </ParticipantMenuItem>
                                        </ParticipantMenuContent>
                                    </ParticipantMenu>
                                    <div className={"gridCellName"}>{participant.displayName}</div>
                                </GridCell>
                            );
                        }}
                        renderSubgridParticipant={({ participant }) => {
                            return (
                                <GridCell className={"subgridCell"} participant={participant}>
                                    <GridVideoView className={"videoView"} />
                                    <div className={"subgridCellName"}>{participant.displayName}</div>
                                </GridCell>
                            );
                        }}
                    />
                </div>
            </>
        );
    },
    argTypes: {
        ...defaultArgs.argTypes,
        gridGap: { control: "range", min: 0, max: 100 },
        videoGridGap: { control: "range", min: 0, max: 100 },
        enableSubgrid: { control: "boolean" },
    },
    args: {
        ...defaultArgs.args,
        gridGap: 0,
        videoGridGap: 0,
        enableSubgrid: true,
    },
};

function VideoGridWithLocalMediaInner({
    roomUrl,
    displayName,
    externalId,
    gridGap,
    videoGridGap,
    enableSubgrid,
    stageParticipantLimit,
}: {
    roomUrl: string;
    displayName?: string;
    externalId?: string;
    gridGap?: number;
    videoGridGap?: number;
    enableSubgrid?: boolean;
    stageParticipantLimit?: number;
}) {
    const localMedia = useLocalMedia({ audio: true, video: true });
    const [shouldJoin, setShouldJoin] = React.useState(false);
    const {
        state: { connectionStatus },
        actions: { joinRoom, leaveRoom, knock, cancelKnock },
    } = useRoomConnection(roomUrl, { localMedia, displayName, externalId });

    const handleToggleJoin = () => {
        if (shouldJoin) {
            leaveRoom();
        } else {
            joinRoom();
        }
        setShouldJoin(!shouldJoin);
    };

    return (
        <>
            <PrecallExperience {...localMedia} hideVideoPreview={shouldJoin} />
            <div className="controls">
                <button onClick={handleToggleJoin}>{shouldJoin ? "Leave room" : "Join room"}</button>
                <span>Connection status: {connectionStatus}</span>
            </div>
            {connectionStatus === "room_locked" && (
                <div style={{ color: "red" }}>
                    <span>Room locked, please knock....</span>
                    <button onClick={() => knock()}>Knock</button>
                </div>
            )}
            {connectionStatus === "knocking" && (
                <div>
                    <span>Knocking...</span>
                    <button onClick={() => cancelKnock()}>Cancel</button>
                </div>
            )}
            {connectionStatus === "knock_rejected" && <span>Rejected :(</span>}
            {connectionStatus === "connected" && (
                <div style={{ height: "500px", width: "100%" }}>
                    <VideoGrid
                        gridGap={gridGap}
                        videoGridGap={videoGridGap}
                        stageParticipantLimit={stageParticipantLimit}
                        enableSubgrid={enableSubgrid}
                    />
                </div>
            )}
        </>
    );
}

export const VideoGridWithLocalMedia = {
    render: ({
        roomUrl,
        displayName,
        externalId,
        gridGap,
        videoGridGap,
        enableSubgrid,
        stageParticipantLimit,
    }: {
        roomUrl: string;
        displayName?: string;
        externalId?: string;
        gridGap?: number;
        videoGridGap?: number;
        enableSubgrid?: boolean;
        stageParticipantLimit?: number;
    }) => {
        if (!roomUrl || !roomUrl.match(roomRegEx)) {
            return <p>Set room url on the Controls panel</p>;
        }

        return (
            <VideoGridWithLocalMediaInner
                roomUrl={roomUrl}
                displayName={displayName}
                externalId={externalId}
                gridGap={gridGap}
                videoGridGap={videoGridGap}
                enableSubgrid={enableSubgrid}
                stageParticipantLimit={stageParticipantLimit}
            />
        );
    },
    argTypes: {
        ...defaultArgs.argTypes,
        gridGap: { control: "range", min: 0, max: 100 },
        videoGridGap: { control: "range", min: 0, max: 100 },
        enableSubgrid: { control: "boolean" },
        stageParticipantLimit: { control: { type: "range", min: 1, max: 24 } },
    },
    args: {
        ...defaultArgs.args,
        gridGap: 8,
        videoGridGap: 8,
        enableSubgrid: true,
        stageParticipantLimit: 12,
    },
};

/*
 * Mocked stories: render the grid from fake participants (canvas streams)
 * instead of a room connection, so subgrid behaviour can be tested without
 * joining with a bunch of clients. Camera-off participants populate the subgrid.
 */

const mockedArgTypes = {
    // Room connection controls are irrelevant for the mocked grid
    displayName: { table: { disable: true } },
    roomUrl: { table: { disable: true } },
    externalId: { table: { disable: true } },
    numParticipants: { control: { type: "range", min: 1, max: 36 } },
    numVideosOff: {
        control: { type: "range", min: 0, max: 36 },
        description: "Participants with camera off — these populate the subgrid",
    },
    gridGap: { control: "range", min: 0, max: 100 },
    videoGridGap: { control: "range", min: 0, max: 100 },
    enableSubgrid: { control: "boolean" },
    stageParticipantLimit: { control: { type: "range", min: 1, max: 24 } },
};

const mockedArgs = {
    numParticipants: 16,
    numVideosOff: 6,
    gridGap: 8,
    videoGridGap: 8,
    enableSubgrid: true,
    stageParticipantLimit: 12,
};

interface MockedGridArgs {
    numParticipants: number;
    numVideosOff: number;
    gridGap?: number;
    videoGridGap?: number;
    enableSubgrid?: boolean;
    enableParticipantMenu?: boolean;
    stageParticipantLimit?: number;
}

export const VideoGridMockedStory = {
    render: ({
        numParticipants,
        numVideosOff,
        gridGap,
        videoGridGap,
        enableSubgrid,
        enableParticipantMenu,
        stageParticipantLimit,
    }: MockedGridArgs) => {
        return (
            <FakeParticipantsProvider numParticipants={numParticipants} numVideosOff={numVideosOff}>
                <div style={{ height: "500px", width: "100%" }}>
                    <VideoGrid
                        gridGap={gridGap}
                        videoGridGap={videoGridGap}
                        stageParticipantLimit={stageParticipantLimit}
                        enableSubgrid={enableSubgrid}
                        enableParticipantMenu={enableParticipantMenu}
                    />
                </div>
            </FakeParticipantsProvider>
        );
    },
    argTypes: {
        ...mockedArgTypes,
        enableParticipantMenu: { control: "boolean" },
    },
    args: {
        ...mockedArgs,
        enableParticipantMenu: true,
    },
};

export const VideoGridMockedStoryCustom = {
    render: ({
        numParticipants,
        numVideosOff,
        gridGap,
        videoGridGap,
        enableSubgrid,
        stageParticipantLimit,
    }: MockedGridArgs) => {
        return (
            <FakeParticipantsProvider numParticipants={numParticipants} numVideosOff={numVideosOff}>
                <div style={{ height: "500px", width: "100%" }}>
                    <VideoGrid
                        gridGap={gridGap}
                        videoGridGap={videoGridGap}
                        stageParticipantLimit={stageParticipantLimit}
                        enableSubgrid={enableSubgrid}
                        renderParticipant={({ participant }) => {
                            return (
                                <GridCell className={"gridCell"} participant={participant}>
                                    <GridVideoView className={"videoView"} />
                                    <ParticipantMenu>
                                        <ParticipantMenuTrigger className={"participantMenuTrigger"}>
                                            Actions
                                        </ParticipantMenuTrigger>
                                        <ParticipantMenuContent className={"participantMenuContent"}>
                                            <ParticipantMenuItem
                                                className={"participantMenuItem"}
                                                participantAction={"maximize"}
                                            >
                                                Maximize
                                            </ParticipantMenuItem>
                                            <ParticipantMenuItem
                                                className={"participantMenuItem"}
                                                participantAction={"spotlight"}
                                            >
                                                Spotlight
                                            </ParticipantMenuItem>
                                        </ParticipantMenuContent>
                                    </ParticipantMenu>
                                    <div className={"gridCellName"}>{participant.displayName}</div>
                                </GridCell>
                            );
                        }}
                        renderSubgridParticipant={({ participant }) => {
                            return (
                                <GridCell className={"subgridCell"} participant={participant}>
                                    <GridVideoView className={"videoView"} />
                                    <div className={"subgridCellName"}>{participant.displayName}</div>
                                </GridCell>
                            );
                        }}
                    />
                </div>
            </FakeParticipantsProvider>
        );
    },
    argTypes: mockedArgTypes,
    args: mockedArgs,
};

/**
 * A running integration on the stage, without a room.
 *
 * The content of a real integration is served from the integration's own origin, so it needs a room
 * that has one enabled — that is the "Room integrations" story. What this one shows is where the
 * grid *puts* it, which is the part worth being able to poke at:
 *
 * - the integration takes the whole presentation area, and spotlighted participants drop back into
 *   the video grid rather than sharing the stage with it
 * - a second running integration goes to the subgrid, not the stage
 * - maximizing a participant takes the stage back, and the integration keeps rendering offscreen
 *   rather than unmounting — with a real integration that is the difference between the video
 *   carrying on and restarting from the beginning
 *
 * Spotlight and maximize are on the participant menu, under Actions.
 */
export const VideoGridWithIntegrationMockedStory = {
    name: "Video grid with a room integration (mocked)",
    render: ({
        numParticipants,
        numVideosOff,
        numRunningIntegrations,
        gridGap,
        videoGridGap,
        enableSubgrid,
        stageParticipantLimit,
    }: MockedGridArgs & { numRunningIntegrations: number }) => {
        return (
            <FakeParticipantsProvider
                numParticipants={numParticipants}
                numVideosOff={numVideosOff}
                numRunningIntegrations={numRunningIntegrations}
            >
                <div style={{ height: "500px", width: "100%" }}>
                    <VideoGrid
                        gridGap={gridGap}
                        videoGridGap={videoGridGap}
                        stageParticipantLimit={stageParticipantLimit}
                        enableSubgrid={enableSubgrid}
                        enableParticipantMenu
                        // With a real session this is where useRoomIntegrationView goes — see the
                        // RunningIntegration component in room-integrations.stories.tsx.
                        renderIntegration={({ session }) => (
                            <div
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    background: "#1b1b2a",
                                    color: "#fff",
                                    borderRadius: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 4,
                                    fontFamily: "sans-serif",
                                }}
                            >
                                <strong>{session.integration.title}</strong>
                                <span style={{ fontSize: 11, opacity: 0.7 }}>
                                    {session.isPresenter
                                        ? "shared by you"
                                        : `shared by ${session.presenterDisplayName}`}
                                </span>
                                <span style={{ fontSize: 10, opacity: 0.5 }}>{session.roomIntegrationSessionId}</span>
                            </div>
                        )}
                    />
                </div>
            </FakeParticipantsProvider>
        );
    },
    argTypes: {
        ...mockedArgTypes,
        numRunningIntegrations: {
            control: { type: "range", min: 0, max: 3 },
            description: "Running integrations. The first takes the stage; the rest go to the subgrid.",
        },
    },
    args: {
        ...mockedArgs,
        numParticipants: 5,
        numVideosOff: 1,
        numRunningIntegrations: 1,
    },
};
