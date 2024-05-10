import React, { useEffect, useCallback, useState } from "react";
import { useRoomConnection, useLocalMedia, UseLocalMediaResult } from "@whereby.com/browser-sdk/react";
import {
    getFakeMediaStream,
    NotificationEvent,
    ChatMessageEvent,
    RequestAudioEvent,
    SignalStatusEvent,
    StickyReactionEvent,
} from "@whereby.com/core";
import toast, { Toaster } from "react-hot-toast";

import "./App.css";

const WaitingArea = ({ knock }: { knock: () => void }) => {
    return (
        <div>
            <h1>Room locked</h1>
            <p>Waiting for host to let you in</p>
            <button onClick={knock}>Knock</button>
        </div>
    );
};

const ChatInput = ({ sendChatMessage }: { sendChatMessage: (message: string) => void }) => {
    const [message, setMessage] = useState("");
    return (
        <div>
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} data-testid="chatInput" />
            <button
                data-testid="sendChatMessageBtn"
                onClick={() => {
                    if (!message) return;
                    sendChatMessage(message);
                    setMessage("");
                }}
            >
                Send
            </button>
        </div>
    );
};

type RoomProps = {
    roomUrl: string;
    localMedia: UseLocalMediaResult;
    displayName: string;
    isHost: boolean;
};
const Room = ({ roomUrl, localMedia, displayName, isHost }: RoomProps) => {
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

    const roomConnection = useRoomConnection(roomUrl, {
        localMedia,
        displayName,
    });

    const {
        waitingParticipants,
        remoteParticipants,
        localParticipant,
        connectionStatus,
        chatMessages,
        cloudRecording,
        liveStream,
        screenshares,
        events,
    } = roomConnection.state;
    const {
        acceptWaitingParticipant,
        knock,
        rejectWaitingParticipant,
        sendChatMessage,
        toggleCamera,
        toggleMicrophone,
        startScreenshare,
        stopScreenshare,
        joinRoom,
        leaveRoom,
        toggleRaiseHand,
        askToSpeak,
    } = roomConnection.actions;
    const { VideoView } = roomConnection.components;

    useEffect(() => {
        setIsCameraEnabled(localParticipant?.isVideoEnabled || false);
    }, [localParticipant?.isVideoEnabled]);

    useEffect(() => {
        setIsMicrophoneEnabled(localParticipant?.isAudioEnabled || false);
    }, [localParticipant?.isAudioEnabled]);

    function showIncomingChatMessageNotification({ message }: NotificationEvent<ChatMessageEvent>) {
        toast(message, {
            icon: "💬",
        });
    }

    function showRequestAudioEnableNotification({ message }: NotificationEvent<RequestAudioEvent>) {
        toast(
            (t) => (
                <div>
                    {message}
                    <div>
                        <button
                            data-testid="unmuteMicrophoneBtn"
                            onClick={() => {
                                toggleMicrophone(true);
                                toast.dismiss(t.id);
                            }}
                        >
                            Unmute microphone
                        </button>{" "}
                        <button onClick={() => toast.dismiss(t.id)}>Got it</button>
                    </div>
                </div>
            ),
            {
                id: "requestAudioEnable",
                duration: Infinity,
            },
        );
    }

    function showRequestAudioDisableNotification({ message }: NotificationEvent<RequestAudioEvent>) {
        toast(message, {
            id: "requestAudioDisable",
        });
    }

    function showSignalTroubleNotification({ message }: NotificationEvent<SignalStatusEvent>) {
        toast.error(message, {
            id: "signalTrouble",
            duration: Infinity,
        });
    }

    function hideSignalTroublenNotification() {
        toast.remove("signalTrouble");
    }

    function showRemoteHandRaised({ message, props }: NotificationEvent<StickyReactionEvent>) {
        toast(
            (t) => (
                <div>
                    {message}
                    <div>
                        <button
                            data-testid="askToSpeakBtn"
                            onClick={() => {
                                if (props?.client?.id) {
                                    askToSpeak(props.client.id);
                                }
                                toast.dismiss(t.id);
                            }}
                        >
                            Ask to speak
                        </button>{" "}
                        <button onClick={() => toast.dismiss(t.id)}>Dismiss</button>
                    </div>
                </div>
            ),
            {
                id: `remoteHandRaised-${props?.client?.id}`,
                icon: props?.stickyReaction?.reaction,
                duration: Infinity,
            },
        );
    }

    function hideRemoteHandRaised({ props }: NotificationEvent<StickyReactionEvent>) {
        toast.remove(`remoteHandRaised-${props?.client?.id}`);
    }

    useEffect(() => {
        const sdkEventHandler = (event: NotificationEvent) => {
            switch (event.type) {
                case "chatMessageReceived":
                    showIncomingChatMessageNotification(event as NotificationEvent<ChatMessageEvent>);
                    break;
                case "requestAudioEnable":
                    showRequestAudioEnableNotification(event as NotificationEvent<RequestAudioEvent>);
                    break;
                case "requestAudioDisable":
                    showRequestAudioDisableNotification(event as NotificationEvent<RequestAudioEvent>);
                    break;
                case "signalTrouble":
                    showSignalTroubleNotification(event as NotificationEvent<SignalStatusEvent>);
                    break;
                case "signalOk":
                    hideSignalTroublenNotification();
                    break;
                case "remoteHandRaised":
                    showRemoteHandRaised(event as NotificationEvent<StickyReactionEvent>);
                    break;
                case "remoteHandLowered":
                    hideRemoteHandRaised(event as NotificationEvent<StickyReactionEvent>);
                    break;
            }
        };

        // Use wildcard to catch _all_ notifications
        events?.on("*", sdkEventHandler);

        return () => {
            events?.off("*", sdkEventHandler);
        };
    }, [events]);

    if (connectionStatus === "ready") {
        return (
            <button data-testid="joinRoomBtn" onClick={() => joinRoom()}>
                Join room
            </button>
        );
    }

    if (connectionStatus === "left" || connectionStatus === "kicked") {
        return (
            <button data-testid="rejoinRoomBtn" onClick={() => joinRoom()}>
                Re-join {connectionStatus} room
            </button>
        );
    }

    if (connectionStatus === "room_locked") {
        return <WaitingArea knock={knock} />;
    }

    if (connectionStatus === "knock_rejected") {
        return <p data-testid="knockRejectedMessage">You have been rejected access</p>;
    }

    return (
        <div>
            <h1>Room</h1>
            <dl>
                <dt>Connection Status</dt>
                <dd data-testid="connectionStatus">{connectionStatus}</dd>
                <dt>Local client ID</dt>
                <dd data-testid="localClientId">{localParticipant?.id || "N/A"}</dd>
                <dt>Cloud recording status</dt>
                <dd data-testid="cloudRecordingStatus">{cloudRecording?.status || "N/A"}</dd>
                <dt>Streaming status</dt>
                <dd data-testid="streamingStatus">{liveStream?.status || "N/A"}</dd>
            </dl>
            <div className="Controls">
                <button data-testid="startScreenshareBtn" onClick={() => startScreenshare()}>
                    Start screen share
                </button>
                <button data-testid="stopScreenshareBtn" onClick={() => stopScreenshare()}>
                    Stop screen share
                </button>
                {localParticipant && (
                    <>
                        <button
                            data-testid="toggleCameraBtn"
                            onClick={() => {
                                toggleCamera(!isCameraEnabled);
                                setIsCameraEnabled(!isCameraEnabled);
                            }}
                        >
                            {isCameraEnabled ? "Disable" : "Enable"} camera
                        </button>
                        <button
                            data-testid="toggleMicrophoneBtn"
                            disabled={!localParticipant.stream?.getAudioTracks().length}
                            onClick={() => {
                                toggleMicrophone(!isMicrophoneEnabled);
                                setIsMicrophoneEnabled(!isMicrophoneEnabled);
                            }}
                        >
                            {isMicrophoneEnabled ? "Disable" : "Enable"} microphone
                        </button>
                        <button data-testid="toggleRaisedHandBtn" onClick={() => toggleRaiseHand()}>
                            {localParticipant?.stickyReaction ? "Lower" : "Raise"} hand
                        </button>
                    </>
                )}
                <button data-testid="leaveRoomBtn" onClick={() => leaveRoom()}>
                    Leave room
                </button>
            </div>
            {isHost && waitingParticipants.length > 0 && (
                <div>
                    <h3>Knocking participants ({waitingParticipants.length})</h3>
                    <ul>
                        {waitingParticipants.map((a) => (
                            <li key={a.id} data-testid="knockRequest">
                                <p>{a.displayName}</p>
                                <button onClick={() => acceptWaitingParticipant(a.id)}>Let in</button>
                                <button onClick={() => rejectWaitingParticipant(a.id)}>Reject</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {remoteParticipants.length > 0 && (
                <div>
                    <h3>Remote participants ({remoteParticipants.length})</h3>
                    <div className="RemoteParticipants" data-testid="remoteParticipantList">
                        {remoteParticipants.map((r) => (
                            <div key={r.id} data-testid="remoteParticipant">
                                {r.stream && r.isVideoEnabled ? (
                                    <VideoView
                                        style={{ width: "250px" }}
                                        stream={r.stream}
                                        data-testid="remoteParticipantVideo"
                                    />
                                ) : (
                                    <div className="NoStreamCell">Participant's camera is off</div>
                                )}
                                <div data-testid="remoteParticipantAudioStatus">
                                    Audio is {r.isAudioEnabled ? "on" : "off"}
                                </div>
                                {r.stickyReaction && (
                                    <div data-testid="remoteParticipantStickyReactionStatus">
                                        {r.stickyReaction.reaction}
                                    </div>
                                )}
                                <p>{r.displayName}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {screenshares?.length > 0 && (
                <div>
                    <h3>Screenshares ({screenshares.length})</h3>
                    <div className="Screenshares">
                        {screenshares.map((s) => (
                            <div key={s.id || s.participantId}>
                                {s.stream && (
                                    <VideoView style={{ width: "250px" }} stream={s.stream} data-testid="screenShare" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {localParticipant && (
                <div className="LocalParticipant" data-testid="localParticipant">
                    <h3>Local Participant</h3>
                    {localParticipant.stream && isCameraEnabled ? (
                        <VideoView style={{ width: "200px" }} stream={localParticipant.stream} />
                    ) : (
                        <div className="NoStreamCell">Your camera is off</div>
                    )}
                    <p>{localParticipant.displayName} (you)</p>
                </div>
            )}

            <div data-testid="chatMessages">
                {chatMessages.length > 0 ? (
                    <div>
                        <h3>Chat messages ({chatMessages.length})</h3>
                        <ul>
                            {chatMessages.map((m) => (
                                <li key={m.timestamp}>
                                    {m.senderId}: {m.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p>No chat messages</p>
                )}
            </div>
            <ChatInput sendChatMessage={sendChatMessage} />
            <Toaster
                position="top-right"
                toastOptions={{
                    className: "toaster",
                }}
            />
        </div>
    );
};

const CanvasWrapper = ({ roomUrl, canvasStream }: { roomUrl: string; canvasStream: MediaStream }) => {
    const localMedia = useLocalMedia(canvasStream);
    const isHost = roomUrl.includes("roomKey=");

    return (
        <Room
            roomUrl={roomUrl}
            localMedia={localMedia}
            displayName={`SDK boy${isHost ? " (host)" : ""}`}
            isHost={isHost}
        />
    );
};

const App = () => {
    const [roomUrlInput, setRoomUrlInput] = useState<string>("");
    const [roomUrl, setRoomUrl] = useState<string>();
    const [localStream, setLocalStream] = useState<MediaStream>();
    const [canvas, setCanvas] = useState<HTMLCanvasElement>();
    const [hasAudio, setHasAudio] = useState<boolean>(false);

    const canvasRef = useCallback((canvas: HTMLCanvasElement) => {
        setCanvas(canvas);
        const stream = getFakeMediaStream({ canvas });
        setLocalStream(stream);
    }, []);

    function toggleFakeAudio() {
        if (!canvas) {
            return;
        }

        const stream = getFakeMediaStream({ canvas, hasAudio: !hasAudio });
        setLocalStream(stream);
        setHasAudio(!hasAudio);
    }

    return (
        <div>
            {roomUrl ? (
                localStream ? (
                    <CanvasWrapper roomUrl={roomUrl} canvasStream={localStream} />
                ) : (
                    <p>loading</p>
                )
            ) : (
                <div>
                    <h1>Enter room URL</h1>
                    <label>Room URL</label>
                    <input type="text" onChange={(e) => setRoomUrlInput(e.target.value)} defaultValue={roomUrlInput} />
                    <br />
                    <button onClick={() => setRoomUrl(roomUrlInput)}>Enter</button>
                </div>
            )}

            <hr />
            <div className="LocalStreamCanvas">
                <h3>Canvas for local stream</h3>
                {!roomUrl && (
                    <button onClick={toggleFakeAudio} data-testid="toggleFakeAudio">
                        Toggle fake audio
                    </button>
                )}
                {localStream && (
                    <dl data-testid="fakeMediaStats">
                        <dt>Audio track</dt>
                        <dd data-testid="fakeAudioTrackStatus">
                            {localStream.getAudioTracks().length ? "ready" : "missing"}
                        </dd>
                        <dt>Video track</dt>
                        <dd data-testid="fakeWebcamStatus">
                            {localStream.getVideoTracks().length ? "ready" : "missing"}
                        </dd>
                    </dl>
                )}
                <br />
                <canvas ref={canvasRef} width="640" height="480" />
            </div>
        </div>
    );
};

export default App;
