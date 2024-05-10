import React, { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

import DisplayNameForm from "./DisplayNameForm";
import { UseLocalMediaResult } from "../../lib/react/useLocalMedia/types";
import { useRoomConnection } from "../../lib/react/useRoomConnection";
import { NotificationEvent, RemoteParticipant } from "@whereby.com/core";

export default function VideoExperience({
    displayName,
    roomName,
    roomKey,
    localMedia,
    externalId,
    showHostControls,
    hostOptions,
}: {
    displayName?: string;
    roomName: string;
    roomKey?: string;
    localMedia?: UseLocalMediaResult;
    externalId?: string;
    showHostControls?: boolean;
    hostOptions?: Array<string>;
}) {
    const [chatMessage, setChatMessage] = useState("");
    const [isLocalScreenshareActive, setIsLocalScreenshareActive] = useState(false);

    const { state, actions, components } = useRoomConnection(roomName, {
        localMediaOptions: {
            audio: true,
            video: true,
        },
        ...(Boolean(displayName) && { displayName }),
        ...(Boolean(roomKey) && { roomKey }),
        ...(Boolean(localMedia) && { localMedia }),
        ...(Boolean(externalId) && { externalId }),
    });

    const { localParticipant, remoteParticipants, connectionStatus, waitingParticipants, screenshares, events } = state;
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
        toggleRaiseHand,
        askToSpeak,
        acceptWaitingParticipant,
        rejectWaitingParticipant,
        startScreenshare,
        stopScreenshare,
    } = actions;
    const { VideoView } = components;

    function showIncomingChatMessageNotification(message: string) {
        toast(message, {
            icon: "💬",
        });
    }

    function showRequestAudioEnableNotification(message: string) {
        toast(
            (t) => (
                <div>
                    {message}
                    <div>
                        <button
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

    function showRequestAudioDisableNotification(message: string) {
        toast(message, {
            id: "requestAudioDisable",
        });
    }

    function showSignalTroubleNotification(message: string) {
        toast.error(message, {
            id: "signalTrouble",
            duration: Infinity,
        });
    }

    function hideSignalTroublenNotification() {
        toast.remove("signalTrouble");
    }

    function showRemoteHandRaised(
        message: string,
        props?: { client?: RemoteParticipant; stickyReaction?: { reaction: string } | null },
    ) {
        toast(
            (t) => (
                <div>
                    {message}
                    <div>
                        <button
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

    function hideRemoteHandRaised(props?: { client?: RemoteParticipant }) {
        toast.remove(`remoteHandRaised-${props?.client?.id}`);
    }

    useEffect(() => {
        const sdkEventHandler = ({ type, message, props }: NotificationEvent) => {
            switch (type) {
                case "chatMessageReceived":
                    showIncomingChatMessageNotification(message);
                    break;
                case "requestAudioEnable":
                    showRequestAudioEnableNotification(message);
                    break;
                case "requestAudioDisable":
                    showRequestAudioDisableNotification(message);
                    break;
                case "signalTrouble":
                    showSignalTroubleNotification(message);
                    break;
                case "signalOk":
                    hideSignalTroublenNotification();
                    break;
                case "remoteHandRaised":
                    showRemoteHandRaised(message, props);
                    break;
                case "remoteHandLowered":
                    hideRemoteHandRaised(props);
                    break;
            }
        };

        // Use wildcard to catch _all_ notifications
        events?.on("*", sdkEventHandler);

        return () => {
            events?.off("*", sdkEventHandler);
        };
    }, [events]);

    return (
        <div>
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
                    {waitingParticipants.length > 0 && (
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
                    )}
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
                        {[localParticipant, ...remoteParticipants].map((participant, i) => (
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
                                            {participant.stickyReaction && (
                                                <div>{participant.stickyReaction?.reaction}</div>
                                            )}
                                            {showHostControls && participant.id !== localParticipant?.id ? (
                                                <div>
                                                    {" "}
                                                    {participant.isAudioEnabled && (
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
                                                        </button>
                                                    )}{" "}
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
                                                </div>
                                            ) : null}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        ))}
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
                        <button onClick={() => toggleRaiseHand()}>Toggle raise hand</button>
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
                </>
            )}
            {connectionStatus === "leaving" && <span>Leaving...</span>}
            {connectionStatus === "disconnected" && <span>Disconnected</span>}
            {["kicked", "left"].includes(connectionStatus) && (
                <button onClick={() => joinRoom()}>Re-join {connectionStatus} room</button>
            )}
            <Toaster
                position="top-right"
                toastOptions={{
                    className: "toaster",
                }}
            />
        </div>
    );
}
