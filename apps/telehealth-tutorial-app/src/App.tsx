import * as React from "react";
import "./App.css";
import { useRoomConnection, VideoView } from "@whereby.com/browser-sdk/react";
import IconButton from "./IconButton";
import ChatInput from "./ChatInput";

const WaitingArea = ({ knock }: { knock: () => void }) => {
    return (
        <div>
            <h1>Room locked</h1>
            <p>Waiting for host to let you in</p>
            <button onClick={knock}>Knock</button>
        </div>
    );
};

// Replace this with your own Whereby room URL
const ROOM_URL = "";

function App() {
    const [isCameraActive, setIsCameraActive] = React.useState(true);
    const [isMicrophoneActive, setIsMicrophoneActive] = React.useState(true);
    const [isLocalScreenshareActive, setIsLocalScreenshareActive] = React.useState(false);
    const chatMessageBottomRef = React.useRef<HTMLDivElement>(null);

    if (!ROOM_URL) {
        return <div>No room URL provided</div>;
    }

    const roomConnection = useRoomConnection(ROOM_URL, {
        localMediaOptions: {
            audio: true,
            video: true,
        },
    });

    const { state, actions } = roomConnection;
    const { localParticipant, remoteParticipants, screenshares, chatMessages } = state;
    const {
        joinRoom,
        leaveRoom,
        toggleCamera,
        toggleMicrophone,
        startScreenshare,
        stopScreenshare,
        sendChatMessage,
        knock,
    } = actions;

    function getDisplayName(id: string) {
        return remoteParticipants.find((p) => p.id === id)?.displayName || "Guest";
    }

    function scrollToBottom() {
        chatMessageBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    React.useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    if (state.connectionStatus === "connecting" || state.connectionStatus === "ready") {
        return (
            <button data-testid="joinRoomBtn" onClick={() => joinRoom()}>
                Join room
            </button>
        );
    }

    if (state.connectionStatus === "left" || state.connectionStatus === "kicked") {
        return (
            <button data-testid="rejoinRoomBtn" onClick={() => joinRoom()}>
                Re-join {state.connectionStatus} room
            </button>
        );
    }

    if (state.connectionStatus === "room_locked") {
        return <WaitingArea knock={knock} />;
    }

    if (state.connectionStatus === "knocking") {
        return <p>Knocking...</p>;
    }

    if (state.connectionStatus === "knock_rejected") {
        return <p data-testid="knockRejectedMessage">You have been rejected access</p>;
    }

    return (
        <div className="App">
            <div className="left-section">
                <div className="chat-wrapper">
                    {chatMessages.map((message) => (
                        <>
                            <p className="chat-message">{message.text}</p>
                            <p className="chat-message-name">{getDisplayName(message.senderId)}</p>
                        </>
                    ))}
                    <div ref={chatMessageBottomRef} />
                </div>
                {localParticipant?.stream ? (
                    <div className="self-view-wrapper">
                        <VideoView mirror muted stream={localParticipant.stream} />
                        <p className="self-name">You</p>
                    </div>
                ) : null}
                <ChatInput sendChatMessage={sendChatMessage} />
            </div>
            <div className="video-stage">
                {remoteParticipants[0]?.stream ? (
                    <div className={screenshares.length ? "remote-view-small" : "remote-view-wrapper"}>
                        <VideoView stream={remoteParticipants[0].stream} />
                        <p className={screenshares.length ? "screenshare-remote-name" : "remote-name"}>
                            {remoteParticipants[0].displayName}
                        </p>
                    </div>
                ) : null}
                {screenshares[0]?.stream ? (
                    <div className="screenshare-view-wrapper">
                        <VideoView stream={screenshares[0].stream} />
                    </div>
                ) : null}
            </div>
            <div className="control-wrapper">
                <div className="buttons">
                    <IconButton
                        variant="camera"
                        onClick={() => {
                            setIsCameraActive((prev) => !prev);
                            toggleCamera();
                        }}
                        isActive={isCameraActive}
                    >
                        Cam
                    </IconButton>
                    <IconButton
                        variant="microphone"
                        onClick={() => {
                            setIsMicrophoneActive((prev) => !prev);
                            toggleMicrophone();
                        }}
                        isActive={isMicrophoneActive}
                    >
                        Mic
                    </IconButton>
                    <IconButton
                        variant="share"
                        onClick={() => {
                            if (isLocalScreenshareActive) {
                                stopScreenshare();
                            } else {
                                startScreenshare();
                            }
                            setIsLocalScreenshareActive((prev) => !prev);
                        }}
                        isActive={isLocalScreenshareActive}
                    >
                        {isLocalScreenshareActive ? "Stop" : "Share"}
                    </IconButton>
                </div>
            </div>
        </div>
    );
}

export default App;
