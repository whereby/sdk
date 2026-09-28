import React from "react";
import { StoryObj } from "@storybook/react-vite";

import {
    useRoomConnection,
    useRoomIntegrationPicker,
    useRoomIntegrationView,
    roomIntegrationContent,
    RoomIntegrationContent,
    RoomIntegration,
    RoomIntegrationPickerResult,
    RoomIntegrationSessionView,
} from "../lib/react";
import { Grid as VideoGrid } from "../lib/react/Grid";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import "./styles.css";

const defaultArgs: StoryObj = {
    name: "Examples/Room integrations",
    argTypes: {
        displayName: { control: "text" },
        roomUrl: { control: "text", type: { required: true } },
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

const STARTERS: Record<string, { placeholder: string; build: (input: string) => RoomIntegrationContent | null }> = {
    youtube: {
        placeholder: "youtube url or video id",
        build: (url) => roomIntegrationContent.youtube({ url }),
    },
    miro: {
        placeholder: "https://miro.com/app/live-embed/...",
        build: (accessLink) => roomIntegrationContent.miro({ accessLink }),
    },
};

function MessageLog() {
    const [messages, setMessages] = React.useState<string[]>([]);

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const type = event.data?.type;
            if (typeof type !== "string" || !type.startsWith("whereby:")) {
                return;
            }
            const at = new Date().toISOString().substring(11, 23);
            setMessages((prev) =>
                [`${at}  ${type}  ${JSON.stringify(event.data.payload ?? {})}`, ...prev].slice(0, 40),
            );
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return (
        <div>
            <h4>frame → host messages</h4>
            <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto", background: "#f4f4f4", padding: 8 }}>
                {messages.join("\n") || "(nothing yet)"}
            </pre>
        </div>
    );
}

/**
 * The frame a consumer writes around the picker hook. The SDK ships no component for this: every
 * pixel inside the frame comes from the integration's own origin, so the only thing left to own is
 * where it sits and how big it is.
 */
function IntegrationPicker({
    integration,
    onPicked,
    onDone,
}: {
    integration: RoomIntegration;
    onPicked: (content: RoomIntegrationPickerResult) => void;
    onDone: () => void;
}) {
    const { iframeProps } = useRoomIntegrationPicker({
        integration,
        onPicked: (content) => {
            onPicked(content);
            onDone();
        },
        onCancel: onDone,
        onError: (error) => {
            console.warn("picker failed:", error.message);
            onDone();
        },
    });

    return iframeProps ? <iframe {...iframeProps} style={{ border: "none", width: "100%", height: "100%" }} /> : null;
}

/**
 * The same, for a running integration. Fills whatever box it is given — a grid cell sizes it, so it
 * must not bring a size of its own.
 */
function RunningIntegrationFrame({ session }: { session: RoomIntegrationSessionView }) {
    const { iframeProps } = useRoomIntegrationView({
        session,
        onContentReady: () => console.warn("contentReady", session.roomIntegrationSessionId),
        onAudioOverride: (enabled) => console.warn("audioOverride", enabled),
    });

    return iframeProps ? (
        <iframe {...iframeProps} allowFullScreen style={{ border: "none", width: "100%", height: "100%" }} />
    ) : null;
}

/** The frame plus a box to put it in and the volume controls the hook hands back. */
function RunningIntegration({ session }: { session: RoomIntegrationSessionView }) {
    const { iframeProps, getVolume, setVolume } = useRoomIntegrationView({ session });

    return (
        <>
            <div
                style={{
                    ...(session.integration.type === "video" ? { aspectRatio: "16 / 9" } : { height: "70vh" }),
                    background: "#000",
                    marginBottom: 8,
                }}
            >
                {iframeProps ? (
                    <iframe
                        {...iframeProps}
                        allowFullScreen
                        style={{ border: "none", width: "100%", height: "100%" }}
                    />
                ) : null}
            </div>
            <div style={{ marginBottom: 16 }}>
                <button onClick={() => getVolume().then((v) => alert(`volume ${v}`))}>get volume</button>
                <button onClick={() => setVolume(0.2)}>volume 0.2</button>
            </div>
        </>
    );
}

function RoomIntegrations({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) {
    const { state, actions } = useRoomConnection(roomUrl, {
        displayName,
        localMediaOptions: { audio: false, video: false },
    });
    const { connectionStatus, roomIntegrations } = state;
    const [name, setName] = React.useState("youtube");
    const [input, setInput] = React.useState("dQw4w9WgXcQ");
    const [picking, setPicking] = React.useState<RoomIntegration | null>(null);

    const startable = roomIntegrations.embeddable.filter((integration) => STARTERS[integration.name]);
    const selected = startable.find((integration) => integration.name === name);
    const starter = STARTERS[name];
    const built = starter && input ? starter.build(input) : null;

    const start = () => {
        if (!selected || !built) return;
        actions.startRoomIntegration({ roomIntegrationId: selected.roomIntegrationId, ...built });
    };

    return (
        <div style={{ display: "flex", gap: 16, padding: 16, fontFamily: "sans-serif" }}>
            <div style={{ width: 320, flexShrink: 0 }}>
                <p>
                    <strong>{connectionStatus}</strong>
                </p>
                {connectionStatus !== "connected" && <button onClick={() => actions.joinRoom()}>Join room</button>}

                <h4>catalog</h4>
                <p style={{ fontSize: 12 }}>
                    {!roomIntegrations.hasFetched
                        ? "fetching…"
                        : roomIntegrations.enabled
                              .map((i) => `${i.name}${i.isEmbeddable ? "" : " (not embeddable)"}`)
                              .join(", ") || "none enabled"}
                </p>
                <p style={{ fontSize: 11, color: "#666" }}>
                    Non-embeddable integrations are listed but cannot be started or rendered — Trello&apos;s
                    frame-ancestors policy cannot cover customer origins, and Google Drive needs a per-viewer Google
                    sign-in.
                </p>
                {roomIntegrations.hasFetched && !startable.length && (
                    <p style={{ fontSize: 12, color: "#b00" }}>
                        No startable integration is enabled for this room — enable one in the Whereby app first.
                    </p>
                )}
                {roomIntegrations.error && (
                    <p style={{ color: "#b00" }}>
                        [{roomIntegrations.error.code}] {roomIntegrations.error.message}
                    </p>
                )}

                <h4>start</h4>
                <select
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setInput("");
                    }}
                    style={{ width: "100%" }}
                >
                    {startable.map((integration) => (
                        <option key={integration.name} value={integration.name}>
                            {integration.title}
                        </option>
                    ))}
                </select>
                <input
                    value={input}
                    placeholder={starter?.placeholder}
                    onChange={(e) => setInput(e.target.value)}
                    style={{ width: "100%" }}
                />
                {input && !built && (
                    <p style={{ fontSize: 11, color: "#b00" }}>
                        Does not look like a {selected?.title} url — check the placeholder.
                    </p>
                )}
                <button onClick={start} disabled={!selected || !built || connectionStatus !== "connected"}>
                    Share
                </button>

                <h4>start with the picker embedded</h4>
                <p style={{ fontSize: 11 }}>
                    Same hosted page, loaded in an iframe we position and size. Nothing to block, and no separate tab on
                    mobile. Watch for a provider sign-in that still wants a window of its own.
                </p>
                {roomIntegrations.embeddable.map((integration) => (
                    <button
                        key={`embed-${integration.roomIntegrationId}`}
                        disabled={connectionStatus !== "connected"}
                        onClick={() => setPicking(integration)}
                    >
                        Pick {integration.title} inline
                    </button>
                ))}

                <h4>running ({roomIntegrations.running.length})</h4>
                {roomIntegrations.running.map((session) => (
                    <div key={session.roomIntegrationSessionId} style={{ fontSize: 12, marginBottom: 8 }}>
                        <div>
                            {session.integration.title} —{" "}
                            {session.isPresenter ? "you (presenter)" : `${session.presenterDisplayName} (you: viewer)`}
                        </div>
                        <pre style={{ fontSize: 10, background: "#f4f4f4", padding: 4, overflow: "auto" }}>
                            {JSON.stringify(
                                {
                                    paused: session.props.paused,
                                    playerstate: session.props.playerstate,
                                    seek: session.props.seek,
                                },
                                null,
                                1,
                            )}
                        </pre>
                        <button
                            onClick={() =>
                                actions.stopRoomIntegration({
                                    roomIntegrationSessionId: session.roomIntegrationSessionId,
                                })
                            }
                            disabled={!session.canStop}
                            title={session.canStop ? "" : "Only the presenter or a host can stop this"}
                        >
                            stop
                        </button>
                    </div>
                ))}

                <MessageLog />
            </div>

            <div style={{ flex: 1 }}>
                {picking && (
                    <div
                        style={{
                            width: 600,
                            height: 600,
                            marginBottom: 16,
                            border: "1px solid #ccc",
                            borderRadius: 8,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", padding: 8, fontSize: 12 }}>
                            <span>{picking.title}</span>
                            <button onClick={() => setPicking(null)}>close</button>
                        </div>
                        <div style={{ flex: 1 }}>
                            <IntegrationPicker
                                integration={picking}
                                onPicked={(content) =>
                                    actions.startRoomIntegration({
                                        roomIntegrationId: picking.roomIntegrationId,
                                        ...content,
                                    })
                                }
                                onDone={() => setPicking(null)}
                            />
                        </div>
                    </div>
                )}
                {roomIntegrations.running.map((session) => (
                    <RunningIntegration key={session.roomIntegrationSessionId} session={session} />
                ))}
                {!roomIntegrations.running.length && <p>Nothing running. Share a video, or start one from the app.</p>}
            </div>
        </div>
    );
}

export const RoomIntegrationsStory = {
    name: "Room integrations",
    render: ({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) => {
        if (!roomUrl) {
            return <p>Set STORYBOOK_ROOM, or pass a room url in the controls.</p>;
        }
        return <RoomIntegrations roomUrl={roomUrl} displayName={displayName} />;
    },
};

/**
 * The same integration, placed by the grid instead of rendered beside it.
 *
 * `renderIntegration` is what connects the two: the grid decides where a running integration goes —
 * the stage, the subgrid, or offscreen while something else is maximized — and hands the session
 * back here to be rendered. There is no default renderer, because the content comes from the
 * integration's own origin in a frame this app owns.
 *
 * Share a video from the Room integrations story (or the Whereby app) in the same room, and it
 * appears on the stage here. Spotlight a participant while it runs to see the integration keep the
 * stage; maximize one to see it take the stage back while the video carries on playing offscreen.
 */
function RoomIntegrationsInGrid({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) {
    const [joined, setJoined] = React.useState(false);
    const { state, actions } = useRoomConnection(roomUrl, {
        displayName: displayName || "SDK",
        localMediaOptions: { audio: true, video: true },
    });

    const toggleJoin = () => {
        if (joined) {
            actions.leaveRoom();
        } else {
            actions.joinRoom();
        }
        setJoined(!joined);
    };

    return (
        <>
            <div className="controls">
                <button onClick={toggleJoin}>{joined ? "Leave room" : "Join room"}</button>
                <span style={{ fontSize: 12 }}>
                    {state.connectionStatus} — {state.roomIntegrations.running.length} running
                </span>
            </div>
            <div style={{ height: "70vh", width: "100%" }}>
                <VideoGrid
                    enableParticipantMenu
                    renderIntegration={({ session }) => <RunningIntegrationFrame session={session} />}
                />
            </div>
        </>
    );
}

export const RoomIntegrationsInGridStory = {
    name: "Room integrations in the video grid",
    render: ({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) => {
        if (!roomUrl) {
            return <p>Set STORYBOOK_ROOM, or pass a room url in the controls.</p>;
        }
        return <RoomIntegrationsInGrid roomUrl={roomUrl} displayName={displayName} />;
    },
};
