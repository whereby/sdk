import * as React from "react";

import { StoryFn } from "@storybook/react";

import { useRoomConnection } from "../lib/react";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import { Grid as VideoGrid, GridVideoCell } from "../lib/react/Grid";

const defaultArgs = {
    title: "Examples/Video Grid UI",
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
        (Story: StoryFn) => (
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
                        stageParticipantLimit={3}
                        enableSubgrid={enableSubgrid}
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
        gridGap: 8,
        videoGridGap: 8,
        enableSubgrid: true,
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
                        stageParticipantLimit={3}
                        enableSubgrid={enableSubgrid}
                        renderParticipant={({ participant }) => {
                            return (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <GridVideoView {...participant} />
                                    {participant?.displayName}
                                </div>
                            );
                        }}
                    ></VideoGrid>
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
        gridGap: 8,
        videoGridGap: 8,
        enableSubgrid: true,
    },
};
