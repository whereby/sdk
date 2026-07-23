import * as React from "react";

import { StoryObj } from "@storybook/react-vite";
import "./styles.css";
import { useRoomConnection } from "../lib/react";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import { Grid as VideoGrid, GridCell, GridVideoView } from "../lib/react/Grid";
import {
    ParticipantMenu,
    ParticipantMenuContent,
    ParticipantMenuItem,
    ParticipantMenuTrigger,
} from "../lib/react/Grid/ParticipantMenu";
import { FakeParticipantsProvider } from "./components/FakeGridClient";

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
