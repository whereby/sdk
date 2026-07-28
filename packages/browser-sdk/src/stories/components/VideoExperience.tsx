import React, { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import DisplayNameForm from "./DisplayNameForm";
import { UseLocalMediaResult } from "../../lib/react/useLocalMedia/types";
import { useRoomConnection } from "../../lib/react/useRoomConnection";
import { VideoView } from "../../lib/react/VideoView";
import { getUsableCameraEffectPresets, isAudioDenoiserSupported } from "../../lib/react";
import {
    ChatFileShare,
    ChatMessageEvent,
    RequestAudioEvent,
    SignalStatusEvent,
    StickyReactionEvent,
    NotificationEvents,
    RequestVideoEvent,
    LiveCaptionsState,
} from "@whereby.com/core";

export default function VideoExperience({
    displayName,
    roomName,
    roomKey,
    localMedia,
    externalId,
    showHostControls,
    hostOptions,
    joinRoomOnLoad,
    showBreakoutGroups,
    showCameraEffects,
    showAudioDenoiser,
    showFileSharing,
}: {
    displayName?: string;
    roomName: string;
    roomKey?: string;
    localMedia?: UseLocalMediaResult;
    externalId?: string;
    showHostControls?: boolean;
    hostOptions?: Array<string>;
    joinRoomOnLoad?: boolean;
    showBreakoutGroups?: boolean;
    showCameraEffects?: boolean;
    showAudioDenoiser?: boolean;
    showFileSharing?: boolean;
}) {
    const [chatMessage, setChatMessage] = useState("");
    const [chatMessageParent, setChatMessageParent] = useState("");
    const [isLocalScreenshareActive, setIsLocalScreenshareActive] = useState(false);
    const [effectPresets, setEffectPresets] = useState<Array<string>>([]);
    const [audioDenoiserSupported, setAudioDenoiserSupported] = useState<boolean | null>(null);
    const [audioDenoiserOn, setAudioDenoiserOn] = useState(false);
    const [knockMessages, setKnockMessages] = useState<Record<string, string>>({});

    const { state, actions, events } = useRoomConnection(roomName, {
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
        chatMessages,
        screenshares,
        spotlightedParticipants,
        breakout,
        cloudRecording,
        liveCaptions,
        liveTranscription,
        fileUploads,
    } = state;
    const {
        knock,
        cancelKnock,
        sendChatMessage,
        removeChatMessage,
        sendFiles,
        downloadFile,
        setDisplayName,
        joinRoom,
        leaveRoom,
        lockRoom,
        muteParticipants,
        kickParticipant,
        endMeeting,
        toggleCamera,
        toggleMicrophone,
        toggleHdMode,
        toggleLowDataMode,
        toggleWidescreenMode,
        toggleRaiseHand,
        askToSpeak,
        acceptWaitingParticipant,
        holdWaitingParticipant,
        rejectWaitingParticipant,
        startCloudRecording,
        startLiveCaptions,
        startLiveTranscription,
        startScreenshare,
        stopCloudRecording,
        stopLiveCaptions,
        stopLiveTranscription,
        stopScreenshare,
        spotlightParticipant,
        removeSpotlight,
        turnOffParticipantCameras,
        askToTurnOnCamera,
        joinBreakoutGroup,
        joinBreakoutMainRoom,
        switchCameraEffect,
        switchCameraEffectCustom,
        clearCameraEffect,
        enableAudioDenoiser,
        disableAudioDenoiser,
    } = actions;

    async function handleDownloadFile(file: ChatFileShare) {
        try {
            const blob = await downloadFile(file);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = file.name;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            toast.error(`Failed to download ${file.name}`);
            console.error(error);
        }
    }

    async function loadBackgroundEffects() {
        if (!showCameraEffects) return;

        const usablePresets = await getUsableCameraEffectPresets();
        setEffectPresets(usablePresets);
    }

    async function loadAudioDenoiserSupport() {
        if (!showAudioDenoiser) return;
        setAudioDenoiserSupported(await isAudioDenoiserSupported());
    }

    async function handleEnableAudioDenoiser() {
        await enableAudioDenoiser();
        setAudioDenoiserOn(true);
    }

    async function handleDisableAudioDenoiser() {
        await disableAudioDenoiser();
        setAudioDenoiserOn(false);
    }

    useEffect(() => {
        if (!joinRoomOnLoad) return;

        joinRoom();
        return () => leaveRoom();
    }, []);

    useEffect(() => {
        if (!localParticipant?.stream) return;

        loadBackgroundEffects();
        loadAudioDenoiserSupport();
    }, [localParticipant?.stream]);

    function showIncomingChatMessageNotification({ message }: ChatMessageEvent) {
        toast(message, {
            icon: "💬",
        });
    }

    function showRequestAudioEnableNotification({ message }: RequestAudioEvent) {
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

    function showRequestAudioDisableNotification({ message }: RequestAudioEvent) {
        toast(message, {
            id: "requestAudioDisable",
        });
    }

    function showRequestVideoEnableNotification({ message }: RequestVideoEvent) {
        toast(
            (t) => (
                <div>
                    {message}
                    <div>
                        <button
                            onClick={() => {
                                toggleCamera(true);
                                toast.dismiss(t.id);
                            }}
                        >
                            Start video
                        </button>{" "}
                        <button onClick={() => toast.dismiss(t.id)}>Got it</button>
                    </div>
                </div>
            ),
            {
                id: "requestVideoEnable",
                duration: Infinity,
            },
        );
    }

    function showRequestVideoDisableNotification({ message }: RequestVideoEvent) {
        toast(message, {
            id: "requestVideoDisable",
        });
    }

    function showSignalTroubleNotification({ message }: SignalStatusEvent) {
        toast.remove(); // clear notifications

        toast.error(message, {
            id: "signalTrouble",
            duration: Infinity,
        });
    }

    function hideSignalTroublenNotification() {
        toast.remove("signalTrouble");
    }

    function showRemoteHandRaised({ message, props }: StickyReactionEvent) {
        toast(
            (t) => (
                <div>
                    {message}
                    <div>
                        <button
                            onClick={() => {
                                if (props.client?.id) {
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
                id: `remoteHandRaised-${props.client?.id}`,
                icon: props.stickyReaction?.reaction,
                duration: Infinity,
            },
        );
    }

    function hideRemoteHandRaised({ props }: StickyReactionEvent) {
        toast.remove(`remoteHandRaised-${props.client?.id}`);
    }

    useEffect(() => {
        const sdkEventHandler = (event: NotificationEvents) => {
            switch (event.type) {
                case "chatMessageReceived":
                    showIncomingChatMessageNotification(event);
                    break;
                case "requestAudioEnable":
                    showRequestAudioEnableNotification(event);
                    break;
                case "requestAudioDisable":
                    showRequestAudioDisableNotification(event);
                    break;
                case "signalTrouble":
                    showSignalTroubleNotification(event);
                    break;
                case "signalOk":
                    hideSignalTroublenNotification();
                    break;
                case "remoteHandRaised":
                    showRemoteHandRaised(event);
                    break;
                case "remoteHandLowered":
                    hideRemoteHandRaised(event);
                    break;
                case "requestVideoEnable":
                    showRequestVideoEnableNotification(event);
                    break;
                case "requestVideoDisable":
                    showRequestVideoDisableNotification(event);
                    break;
            }
        };

        // Use wildcard to catch _all_ notifications
        events?.on("*", sdkEventHandler);

        return () => {
            events?.off("*", sdkEventHandler);
        };
    }, [events]);

    function renderLiveCaptions(captions: LiveCaptionsState) {
        captions?.captionLog.forEach(({ resultId, participantId, text }) => {
            const shouldShowSenderDetails = Boolean(participantId);

            const participant = shouldShowSenderDetails
                ? [localParticipant, ...remoteParticipants].find((participant) => participant?.id === participantId)
                : undefined;

            const captionPrefix = participant ? `${participant.displayName}: ` : undefined;

            const message = `${captionPrefix}${text}`;

            toast(message, {
                id: `caption-${resultId}`,
                position: "bottom-center",
            });
        });
    }

    useEffect(() => {
        if (!state.liveCaptions || state.liveCaptions.status !== "captioning") {
            return;
        }

        renderLiveCaptions(state.liveCaptions);
    }, [state]);

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
            {connectionStatus === "knocking" && (
                <div>
                    <span>Knocking...</span>
                    <button onClick={() => cancelKnock()}>Cancel</button>
                </div>
            )}
            {connectionStatus === "knock_rejected" && <span>Rejected :(</span>}
            {connectionStatus === "connected" && (
                <>
                    {waitingParticipants.length > 0 && (
                        <div className="waiting_room">
                            <h2>Waiting room</h2>
                            {waitingParticipants.map((p) => {
                                const message = knockMessages[p.id] || "";
                                return (
                                    <div key={p.id}>
                                        Waiting: {p.displayName || "unknown"} {p.id}
                                        <input
                                            type="text"
                                            placeholder="Message (optional)"
                                            value={message}
                                            onChange={(e) =>
                                                setKnockMessages((prev) => ({ ...prev, [p.id]: e.target.value }))
                                            }
                                        />
                                        <button onClick={() => acceptWaitingParticipant(p.id)}>Accept</button>
                                        <button onClick={() => holdWaitingParticipant(p.id, message)}>Hold</button>
                                        <button onClick={() => rejectWaitingParticipant(p.id, message)}>Reject</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="roomStatus" style={{ display: "flex", columnGap: "10px" }}>
                        <span>Room status:</span>
                        {showHostControls ? (
                            <>
                                <button
                                    onClick={() => {
                                        if (cloudRecording) {
                                            stopCloudRecording();
                                        } else {
                                            startCloudRecording();
                                        }
                                    }}
                                >
                                    {cloudRecording
                                        ? `Cloud Recording: ${cloudRecording.status}`
                                        : "Start Cloud Recording (if available)"}
                                </button>
                                <button
                                    onClick={() => {
                                        if (liveTranscription) {
                                            stopLiveTranscription();
                                        } else {
                                            startLiveTranscription();
                                        }
                                    }}
                                >
                                    {liveTranscription
                                        ? `Live Transcription: ${liveTranscription.status}`
                                        : "Start Live Transcription (if available)"}
                                </button>
                            </>
                        ) : (
                            <>
                                <span>
                                    {cloudRecording
                                        ? `Cloud Recording: ${cloudRecording.status}`
                                        : "No Cloud Recording"}
                                </span>
                                <span>
                                    {liveTranscription
                                        ? `Live Transcription: ${liveTranscription.status}`
                                        : "No Live Transcription"}
                                </span>
                            </>
                        )}

                        <>
                            <button
                                onClick={() => {
                                    if (liveCaptions) {
                                        stopLiveCaptions();
                                    } else {
                                        startLiveCaptions();
                                    }
                                }}
                            >
                                {liveCaptions
                                    ? `Live Captions: ${liveCaptions.status}`
                                    : "Start Live Captioning (if available)"}
                            </button>
                        </>
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
                    {showBreakoutGroups ? (
                        <div>
                            <h3>Breakout is {breakout.isActive ? "active" : "inactive"}</h3>
                            {breakout.isActive ? <h2>Breakout groups</h2> : null}
                            {breakout.isActive ? <h3>Current group: {breakout.currentGroup?.name}</h3> : null}
                            {breakout.groupedParticipants.map((group) => {
                                // main room
                                if (group.group?.id === "") {
                                    return null;
                                }
                                return (
                                    <div key={group.group?.id}>
                                        <h3>{group.group?.name}</h3>
                                        {group.clients.map((p) => (
                                            <div key={p.id}>{p.displayName || "Guest"}</div>
                                        ))}
                                        <button onClick={() => joinBreakoutGroup(group.group?.id || "")}>Join</button>
                                    </div>
                                );
                            })}
                            {breakout.isActive ? <h2>Main room</h2> : null}
                            {breakout.groupedParticipants.map((p) => {
                                if (p.group?.id === "") {
                                    return p.clients.map((p) => <div key={p.id}>{p.displayName || "Guest"}</div>);
                                }
                                return null;
                            })}
                            {breakout.isActive ? (
                                <button onClick={() => joinBreakoutMainRoom()}>Join main room</button>
                            ) : null}
                        </div>
                    ) : null}

                    {showCameraEffects ? (
                        <div>
                            <button onClick={() => clearCameraEffect()}>Remove background effect</button>
                            <button
                                onClick={async () => {
                                    const imageUrl =
                                        "https://framerusercontent.com/images/7SWEqaKqLoCBQ5Z1jGyEVMOYtI.png?width=800&height=772";
                                    await switchCameraEffectCustom(imageUrl);
                                }}
                            >
                                Set custom background effect (Image URL)
                            </button>
                            <input
                                type={"file"}
                                accept={"image/*"}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = async () => {
                                            const base64data = reader.result;
                                            if (typeof base64data === "string") {
                                                await switchCameraEffectCustom(base64data);
                                            }
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            <select
                                value=""
                                onChange={(e) => {
                                    switchCameraEffect(e.target.value);
                                }}
                            >
                                <option value="" disabled>
                                    Select background effect
                                </option>
                                {effectPresets.map((preset) => (
                                    <option key={preset} value={preset}>
                                        {preset}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}

                    {showAudioDenoiser ? (
                        <div>
                            <strong>Audio denoiser:</strong>{" "}
                            {audioDenoiserSupported === null
                                ? "Checking support…"
                                : audioDenoiserSupported
                                  ? audioDenoiserOn
                                      ? "On"
                                      : "Off"
                                  : "Not supported in this browser"}
                            {audioDenoiserSupported ? (
                                <>
                                    {" "}
                                    <button onClick={handleEnableAudioDenoiser} disabled={audioDenoiserOn}>
                                        Enable
                                    </button>
                                    <button onClick={handleDisableAudioDenoiser} disabled={!audioDenoiserOn}>
                                        Disable
                                    </button>
                                </>
                            ) : null}
                        </div>
                    ) : null}

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
                                                {participant.stream && (
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
                                                        <button
                                                            onClick={() => {
                                                                if (participant.isVideoEnabled) {
                                                                    turnOffParticipantCameras([participant.id]);
                                                                } else {
                                                                    askToTurnOnCamera(participant.id);
                                                                }
                                                            }}
                                                            className={
                                                                localParticipant?.roleName !== "host"
                                                                    ? "hostControlActionDisallowed"
                                                                    : ""
                                                            }
                                                        >
                                                            Turn {participant.isVideoEnabled ? "off" : "on"} camera
                                                        </button>
                                                    </div>
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
                                    <VideoView
                                        style={{ width: 200, height: "auto" }}
                                        key={s.id}
                                        stream={s.stream}
                                        muted={s.isLocal}
                                    />
                                ),
                        )}
                    </div>
                    <div className="controls">
                        <button onClick={() => leaveRoom()}>Leave</button>
                        <button onClick={() => toggleCamera()}>Toggle camera</button>
                        <button onClick={() => toggleMicrophone()}>Toggle microphone</button>
                        <button onClick={() => toggleLowDataMode()}>Toggle low data mode</button>
                        <button onClick={() => toggleHdMode()}>Toggle hd video mode</button>
                        <button onClick={() => toggleWidescreenMode()}>Toggle widescreen video mode</button>
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
                        {chatMessages.length > 0 && <h3>Chat messages</h3>}
                        {chatMessages.map((m) => {
                            return (
                                <div key={m.id}>
                                    {m.parentId && (
                                        <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
                                            Reply to{" "}
                                            <i>
                                                &quot;
                                                {(chatMessages.find((cM) => cM.id === m.parentId) || {}).text}
                                                &quot;
                                            </i>
                                            :{" "}
                                        </div>
                                    )}
                                    {m.removed ? <s>{m.text}</s> : m.text}{" "}
                                    {!m.removed && (m.sig || showHostControls) && (
                                        <button type="button" onClick={() => removeChatMessage(m.id, m.sig)}>
                                            Remove
                                        </button>
                                    )}
                                    {showFileSharing && m.file && (
                                        <button onClick={() => handleDownloadFile(m.file as ChatFileShare)}>
                                            ⬇ {m.file.name} ({Math.round(m.file.size / 1024)} KB)
                                        </button>
                                    )}
                                    <hr />
                                </div>
                            );
                        })}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendChatMessage(chatMessage, chatMessageParent);
                                setChatMessage("");
                                setChatMessageParent("");
                            }}
                        >
                            <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} />
                            <select value={chatMessageParent} onChange={(e) => setChatMessageParent(e.target.value)}>
                                <option key="chat-select-room" value="">
                                    Send to room
                                </option>
                                {chatMessages.map((m) => {
                                    return (
                                        <option key={`chat-select-${m.id}`} value={m.id}>
                                            Reply to: {m.text}
                                        </option>
                                    );
                                })}
                            </select>
                            <button type="submit">Send message</button>
                        </form>
                        {showFileSharing && (
                            <div className="fileSharing">
                                <label>
                                    Share files:{" "}
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files ?? []);
                                            if (files.length) {
                                                sendFiles(files);
                                            }
                                            e.target.value = "";
                                        }}
                                    />
                                </label>
                                {fileUploads.length > 0 && (
                                    <ul className="fileUploads">
                                        {fileUploads.map((upload) => (
                                            <li key={upload.id}>
                                                {upload.name} —{" "}
                                                {upload.status === "error" ? `error: ${upload.error}` : upload.status}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
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
