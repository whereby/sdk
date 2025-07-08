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

        const { actions } = useRoomConnection(roomUrl, { localMediaOptions: { audio: true, video: true } });
        const { toggleCamera, toggleMicrophone, startScreenshare, stopScreenshare, joinRoom, leaveRoom } = actions;

        React.useEffect(() => {
            joinRoom();
            return () => leaveRoom();
        }, []);

        return (
            <>
                <div className="controls">
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

        const { actions } = useRoomConnection(roomUrl, { localMediaOptions: { audio: false, video: true } });
        const { toggleCamera, toggleMicrophone, startScreenshare, stopScreenshare, joinRoom, leaveRoom } = actions;

        React.useEffect(() => {
            joinRoom();
            return () => leaveRoom();
        }, []);

        return (
            <>
                <div className="controls">
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
                                    {participant.displayName}
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
