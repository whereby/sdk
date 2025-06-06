import React, { useCallback, useState, useEffect } from "react";
import { useLocalMedia, UseLocalMediaResult, useRoomConnection, VideoView } from "../lib/react";
import PrecallExperience from "./components/PrecallExperience";
import VideoExperience from "./components/VideoExperience";
import { getFakeMediaStream } from "@whereby.com/core";
import "./styles.css";
import Grid from "./components/Grid";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import { StoryFn } from "@storybook/react";

const defaultArgs = {
    title: "Examples/Custom UI",
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

export const StartStop = () => {
    return <div>Go to this story to eg verify all resources (camera, microphone, connections) are released.</div>;
};

export const RoomConnectionWithLocalMedia = ({
    roomUrl,
    displayName,
    externalId,
}: {
    roomUrl: string;
    displayName?: string;
    externalId?: string;
}) => {
    const localMedia = useLocalMedia({ audio: true, video: true });
    const [shouldJoin, setShouldJoin] = useState(false);

    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }

    return (
        <div>
            <PrecallExperience {...localMedia} hideVideoPreview={shouldJoin} />
            <button onClick={() => setShouldJoin(!shouldJoin)}>{shouldJoin ? "Leave room" : "Join room"}</button>

            {shouldJoin && (
                <VideoExperience
                    displayName={displayName}
                    roomName={roomUrl}
                    localMedia={localMedia}
                    externalId={externalId}
                    joinRoomOnLoad
                />
            )}
        </div>
    );
};

export const LocalMediaOnly = () => {
    const localMedia = useLocalMedia({ audio: true, video: true });

    return (
        <div>
            <PrecallExperience {...localMedia} />
        </div>
    );
};

function CanvasInRoom({ localMedia, roomUrl }: { localMedia: UseLocalMediaResult; roomUrl: string }) {
    const {
        state,
        actions: { joinRoom, leaveRoom },
    } = useRoomConnection(roomUrl, { localMedia });

    useEffect(() => {
        joinRoom();
        return () => leaveRoom();
    }, []);

    return <div>Room connection status: {state.connectionStatus}</div>;
}

function LocalMediaWithCanvasStream_({ canvasStream, roomUrl }: { canvasStream: MediaStream; roomUrl: string }) {
    const [shouldConnect, setShouldConnect] = useState(false);

    const localMedia = useLocalMedia(canvasStream);

    return (
        <div>
            {localMedia.state.localStream && (
                <div>
                    <h3>Connect to room</h3>
                    <h4>Local media (self-view)</h4>
                    <VideoView stream={localMedia.state.localStream} />
                </div>
            )}
            <button onClick={() => setShouldConnect(!shouldConnect)}>
                {shouldConnect ? "Disconnect" : "Connect to room"}
            </button>
            {shouldConnect && <CanvasInRoom localMedia={localMedia} roomUrl={roomUrl} />}
        </div>
    );
}

export const LocalMediaWithFakeMediaStream = ({ roomUrl }: { roomUrl: string }) => {
    const [localStream, setLocalStream] = useState<MediaStream>();
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [canvas, setCanvas] = useState<HTMLCanvasElement>();

    const canvasRef = useCallback((canvas: HTMLCanvasElement) => {
        setCanvas(canvas);
        const stream = getFakeMediaStream({ canvas });
        setLocalStream(stream);
    }, []);

    function addAudioTrack() {
        if (!canvas) {
            return;
        }

        const stream = getFakeMediaStream({ canvas, hasAudio: true });
        setLocalStream(stream);
        setIsAudioReady(true);
    }

    return (
        <div>
            {localStream && isAudioReady && (
                <div>
                    <LocalMediaWithCanvasStream_ canvasStream={localStream} roomUrl={roomUrl} />{" "}
                </div>
            )}
            <div style={{ display: localStream && isAudioReady ? "none" : "block" }}>
                <h3>Set up fake media stream</h3>
                <p>
                    We create a fake webcam stream using an HTML canvas element and a fake audio stream using Web Audio
                    API.
                </p>
                <p>Adding the audio track needs a user interaction, so please click the button below.</p>
                {localStream ? (
                    <button onClick={addAudioTrack}>Add fake audio track</button>
                ) : (
                    <div>Waiting for canvas to be loaded</div>
                )}
                <br />
                <canvas ref={canvasRef} id="canvas" width="640" height="360"></canvas>
            </div>
        </div>
    );
};

export const RoomConnectionOnly = ({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) => {
    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }

    return <VideoExperience displayName={displayName} roomName={roomUrl} />;
};

export const RoomConnectionWithHostControls = {
    render: ({
        roomUrl,
        roomKey,
        displayName,
        roomOptions,
        hostOptions,
    }: {
        roomUrl: string;
        roomKey: string;
        displayName?: string;
        roomOptions: Array<string>;
        hostOptions: Array<string>;
    }) => {
        if (!roomUrl || !roomUrl.match(roomRegEx)) {
            return <p>Set room url on the Controls panel</p>;
        }

        return (
            <VideoExperience
                displayName={displayName}
                roomName={roomUrl}
                roomKey={roomKey}
                showHostControls
                hostOptions={hostOptions}
                joinRoomOnLoad={roomOptions.includes("joinRoomOnLoad")}
            />
        );
    },
    argTypes: {
        ...defaultArgs.argTypes,
        roomKey: { control: "text", type: { required: true } },
        roomOptions: {
            name: "Room options",
            control: {
                type: "check",
                labels: {
                    joinRoomOnLoad: "Join room when useRoomConnection is created",
                },
            },
            options: ["joinRoomOnLoad"],
        },
        hostOptions: {
            name: "Host options",
            control: {
                type: "check",
                labels: {
                    stayBehind: "Stay behind after triggering meeting end",
                },
            },
            options: ["stayBehind"],
        },
    },
    args: {
        ...defaultArgs.args,
        roomKey: process.env.STORYBOOK_ROOM_HOST_ROOMKEY || "[Host roomKey required]",
        roomOptions: [],
        hostOptions: ["stayBehind"],
    },
};

export const ResolutionReporting = ({ roomUrl }: { roomUrl: string; displayName?: string }) => {
    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }

    const roomConnection = useRoomConnection(roomUrl, { localMediaOptions: { audio: false, video: false } });

    const {
        actions: { joinRoom, leaveRoom },
    } = roomConnection;

    useEffect(() => {
        joinRoom();
        return () => leaveRoom();
    }, []);

    return <Grid roomConnection={roomConnection} />;
};

export const RoomConnectionStrictMode = ({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) => {
    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }

    return (
        <React.StrictMode>
            <VideoExperience displayName={displayName} roomName={roomUrl} />
        </React.StrictMode>
    );
};

RoomConnectionStrictMode.parameters = {
    docs: {
        source: {
            code: "Disabled for this story, see https://github.com/storybookjs/storybook/issues/11554",
        },
    },
};

export const RoomConnectionWithBreakoutGroups = ({
    roomUrl,
    displayName,
}: {
    roomUrl: string;
    displayName?: string;
}) => {
    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }

    return <VideoExperience displayName={displayName} roomName={roomUrl} showBreakoutGroups />;
};
