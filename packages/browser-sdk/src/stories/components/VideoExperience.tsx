import React, { useEffect, useState } from "react";
import DisplayNameForm from "./DisplayNameForm";
import { UseLocalMediaResult } from "../../lib/react/useLocalMedia/types";
import { useRoomConnection } from "../../lib/react/useRoomConnection";
import { VideoView } from "../../lib/react/VideoView";

export default function VideoExperience({
    displayName,
    roomName,
    roomKey,
    localMedia,
    externalId,
    showHostControls,
    hostOptions,
    joinRoomOnLoad,
}: {
    displayName?: string;
    roomName: string;
    roomKey?: string;
    localMedia?: UseLocalMediaResult;
    externalId?: string;
    showHostControls?: boolean;
    hostOptions?: Array<string>;
    joinRoomOnLoad?: boolean;
}) {
    const [chatMessage, setChatMessage] = useState("");
    const [isLocalScreenshareActive, setIsLocalScreenshareActive] = useState(false);

    const { state, actions } = useRoomConnection(roomName, {
        localMediaOptions: {
            audio: true,
            video: true,
        },
        ...(Boolean(displayName) && { displayName }),
        ...(Boolean(roomKey) && { roomKey }),
        ...(Boolean(localMedia) && { localMedia }),
        ...(Boolean(externalId) && { externalId }),
    });

    const {
        localParticipant,
        remoteParticipants,
        connectionStatus,
        waitingParticipants,
        screenshares,
        spotlightedParticipants,
    } = state;
    const {
        knock,
        sendChatMessage,
        setDisplayName,
        joinRoom,
        leaveRoom,
        lockRoom,
        muteParticipants,
        kickParticipant,
        endMeeting,
        toggleCamera,
        toggleMicrophone,
        toggleLowDataMode,
        acceptWaitingParticipant,
        rejectWaitingParticipant,
        startScreenshare,
        stopScreenshare,
        spotlightParticipant,
        removeSpotlight,
    } = actions;

    useEffect(() => {
        if (!joinRoomOnLoad) return;

        joinRoom();
        return () => leaveRoom();
    }, []);

    return (
        <div>
            {!joinRoomOnLoad && connectionStatus === "ready" && <button onClick={() => joinRoom()}>Join room</button>}
            {connectionStatus === "connecting" && <span>Connecting...</span>}
            {connectionStatus === "room_locked" && (
                <div style={{ color: "red" }}>
                    <span>Room locked, please knock....</span>
                    <button onClick={() => knock()}>Knock</button>
                </div>
            )}
            {connectionStatus === "knocking" && <span>Knocking...</span>}
            {connectionStatus === "knock_rejected" && <span>Rejected :(</span>}
            {connectionStatus === "connected" && (
                <>
                    <div className="chat">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendChatMessage(chatMessage);
                                setChatMessage("");
                            }}
                        >
                            <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} />
                            <button type="submit">Send message</button>
                        </form>
                    </div>
                    <div className="waiting_room">
                        <h2>Waiting room</h2>
                        {waitingParticipants.map((p) => {
                            return (
                                <div key={p.id}>
                                    Waiting: {p.displayName || "unknown"} {p.id}
                                    <button onClick={() => acceptWaitingParticipant(p.id)}>Accept</button>
                                    <button onClick={() => rejectWaitingParticipant(p.id)}>Reject</button>
                                </div>
                            );
                        })}
                    </div>
                    {showHostControls && (
                        <div className="hostControls">
                            Host controls:
                            <button
                                onClick={() => lockRoom(true)}
                                className={localParticipant?.roleName !== "host" ? "hostControlActionDisallowed" : ""}
                            >
                                Lock room
                            </button>
                            <button
                                onClick={() => lockRoom(false)}
                                className={localParticipant?.roleName !== "host" ? "hostControlActionDisallowed" : ""}
                            >
                                Unlock room
                            </button>
                            <button
                                onClick={() => endMeeting(Boolean(hostOptions?.includes("stayBehind")))}
                                className={localParticipant?.roleName !== "host" ? "hostControlActionDisallowed" : ""}
                            >
                                End meeting
                            </button>
                        </div>
                    )}
                    <div className="container">
                        {[localParticipant, ...remoteParticipants].map((participant, i) => {
                            const isSpotlighted = !!spotlightedParticipants.find((p) => p.id === participant?.id);

                            return (
                                <div className="participantWrapper" key={participant?.id || i}>
                                    {participant ? (
                                        <>
                                            <div
                                                className="bouncingball"
                                                style={{
                                                    animationDelay: `1000ms`,
                                                    ...(participant.isAudioEnabled
                                                        ? {
                                                              border: "2px solid grey",
                                                          }
                                                        : null),
                                                    ...(!participant.isVideoEnabled
                                                        ? {
                                                              backgroundColor: "green",
                                                          }
                                                        : null),
                                                    ...(isSpotlighted
                                                        ? {
                                                              border: "2px solid blue",
                                                          }
                                                        : null),
                                                }}
                                            >
                                                {participant.stream && participant.isVideoEnabled && (
                                                    <VideoView
                                                        muted={participant.isLocalParticipant}
                                                        stream={participant.stream}
                                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                    />
                                                )}
                                            </div>
                                            <div
                                                className="displayName"
                                                title={
                                                    "externalId" in participant
                                                        ? participant.externalId || undefined
                                                        : undefined
                                                }
                                            >
                                                {participant.displayName || "Guest"}
                                                {showHostControls && participant.id !== localParticipant?.id ? (
                                                    <>
                                                        {" "}
                                                        <button
                                                            onClick={() => {
                                                                muteParticipants([participant.id]);
                                                            }}
                                                            className={
                                                                localParticipant?.roleName !== "host"
                                                                    ? "hostControlActionDisallowed"
                                                                    : ""
                                                            }
                                                        >
                                                            Mute
                                                        </button>{" "}
                                                        <button
                                                            onClick={() => {
                                                                kickParticipant(participant.id);
                                                            }}
                                                            className={
                                                                localParticipant?.roleName !== "host"
                                                                    ? "hostControlActionDisallowed"
                                                                    : ""
                                                            }
                                                        >
                                                            Kick
                                                        </button>
                                                    </>
                                                ) : null}
                                                {showHostControls ? (
                                                    <button
                                                        onClick={() => {
                                                            if (isSpotlighted) {
                                                                removeSpotlight(participant.id);
                                                            } else {
                                                                spotlightParticipant(participant.id);
                                                            }
                                                        }}
                                                        className={
                                                            localParticipant?.roleName !== "host"
                                                                ? "hostControlActionDisallowed"
                                                                : ""
                                                        }
                                                    >
                                                        {isSpotlighted ? "Remove spotlight" : "Spotlight"}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            );
                        })}

                        {screenshares.map(
                            (s) =>
                                s.stream && (
                                    <VideoView style={{ width: 200, height: "auto" }} key={s.id} stream={s.stream} />
                                ),
                        )}
                    </div>
                    <div className="controls">
                        <button onClick={() => leaveRoom()}>Leave</button>
                        <button onClick={() => toggleCamera()}>Toggle camera</button>
                        <button onClick={() => toggleMicrophone()}>Toggle microphone</button>
                        <button onClick={() => toggleLowDataMode()}>Toggle low data mode</button>
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
                        <DisplayNameForm initialDisplayName={displayName} onSetDisplayName={setDisplayName} />
                    </div>
                </>
            )}
            {connectionStatus === "leaving" && <span>Leaving...</span>}
            {connectionStatus === "disconnected" && <span>Disconnected</span>}
            {["kicked", "left"].includes(connectionStatus) && (
                <button onClick={() => joinRoom()}>Re-join {connectionStatus} room</button>
            )}
        </div>
    );
}
