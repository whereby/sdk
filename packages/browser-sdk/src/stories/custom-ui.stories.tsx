import React, { useCallback, useState } from "react";
import { useLocalMedia, UseLocalMediaResult, useRoomConnection, VideoView } from "../lib/react";
import PrecallExperience from "./components/PrecallExperience";
import VideoExperience from "./components/VideoExperience";
import { getFakeMediaStream } from "@whereby.com/core";
import "./styles.css";
import Grid from "./components/Grid";
import { Grid as VideoGrid } from "../lib/react/Grid";
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
    const { state } = useRoomConnection(roomUrl, { localMedia });

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
        hostOptions,
    }: {
        roomUrl: string;
        roomKey: string;
        displayName?: string;
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
            />
        );
    },
    argTypes: {
        ...defaultArgs.argTypes,
        roomKey: { control: "text", type: { required: true } },
        hostOptions: {
            name: "Host options",
            control: {
                type: "check",
                labels: { stayBehind: "Stay behind after triggering meeting end" },
            },
            options: ["stayBehind"],
        },
    },
    args: {
        ...defaultArgs.args,
        roomKey: process.env.STORYBOOK_ROOM_HOST_ROOMKEY || "[Host roomKey required]",
        hostOptions: ["stayBehind"],
    },
};

export const ResolutionReporting = ({ roomUrl }: { roomUrl: string; displayName?: string }) => {
    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }

    const roomConnection = useRoomConnection(roomUrl, { localMediaOptions: { audio: false, video: false } });

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

export const GridStory = ({ roomUrl }: { roomUrl: string; displayName?: string }) => {
    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }
    const [isLocalScreenshareActive, setIsLocalScreenshareActive] = useState(false);

    const { actions } = useRoomConnection(roomUrl, { localMediaOptions: { audio: false, video: true } });
    const { toggleCamera, toggleMicrophone, startScreenshare, stopScreenshare } = actions;

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
                <VideoGrid videoGridGap={10} stageParticipantLimit={3} />
            </div>
        </>
    );
};

// export const GridWithCustomVideosStory = ({ roomUrl }: { roomUrl: string; displayName?: string }) => {
//     if (!roomUrl || !roomUrl.match(roomRegEx)) {
//         return <p>Set room url on the Controls panel</p>;
//     }

//     useRoomConnection(roomUrl, { localMediaOptions: { audio: false, video: true } });

//     return (
//         <div style={{ height: "100vh" }}>
//             <VideoGrid
//                 videoGridGap={10}
//                 renderParticipant={({ participant }) => {
//                     if (!participant.stream) {
//                         return null;
//                     }

//                     return (
//                         <div
//                             style={{
//                                 display: "flex",
//                                 flexDirection: "column",
//                                 alignItems: "center",
//                                 justifyContent: "center",
//                                 height: "100%",
//                             }}
//                         >
//                             <VideoView
//                                 style={{
//                                     border: "4px dashed red",
//                                     boxSizing: "border-box",
//                                     borderRadius: "100%",
//                                     objectFit: "cover",
//                                     width: "60%",
//                                 }}
//                                 stream={participant.stream}
//                             />
//                             <p>{participant.displayName}</p>
//                         </div>
//                     );
//                 }}
//             />
//         </div>
//     );
// };
