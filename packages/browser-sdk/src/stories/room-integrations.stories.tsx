import React from "react";
import { StoryObj } from "@storybook/react-vite";

import { useRoomConnection, RoomIntegrationView, roomIntegrationContent, RoomIntegrationContent } from "../lib/react";
import { RoomIntegrationViewHandle } from "../lib/react/RoomIntegrationView";
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

function RoomIntegrations({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) {
    const { state, actions } = useRoomConnection(roomUrl, {
        displayName,
        localMediaOptions: { audio: false, video: false },
    });
    const { connectionStatus, roomIntegrations } = state;
    const [name, setName] = React.useState("youtube");
    const [input, setInput] = React.useState("dQw4w9WgXcQ");
    const viewRef = React.useRef<RoomIntegrationViewHandle>(null);

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
                {roomIntegrations.error && <p style={{ color: "#b00" }}>{roomIntegrations.error}</p>}

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

                <h4>start with the integration&apos;s own picker</h4>
                <p style={{ fontSize: 11 }}>
                    Opens the hosted bootstrap page as a popup. Must be a real click — a blocked popup is reported as an
                    error rather than hanging.
                </p>
                {roomIntegrations.embeddable.map((integration) => (
                    <button
                        key={integration.roomIntegrationId}
                        disabled={connectionStatus !== "connected"}
                        onClick={() =>
                            actions
                                .startRoomIntegrationWithPicker({ roomIntegrationId: integration.roomIntegrationId })
                                .then((started) => console.warn("picker finished, started:", started))
                                .catch((error) => console.warn("picker failed:", error?.message || error))
                        }
                    >
                        Pick {integration.title}
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
                        <button onClick={() => viewRef.current?.getVolume().then((v) => alert(`volume ${v}`))}>
                            get volume
                        </button>
                        <button onClick={() => viewRef.current?.setVolume(0.2)}>volume 0.2</button>
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
                {roomIntegrations.running.map((session) => (
                    <div
                        key={session.roomIntegrationSessionId}
                        style={{
                            ...(session.integration.type === "video" ? { aspectRatio: "16 / 9" } : { height: "70vh" }),
                            background: "#000",
                            marginBottom: 16,
                        }}
                    >
                        <RoomIntegrationView
                            ref={viewRef}
                            session={session}
                            onContentReady={() => console.warn("contentReady", session.roomIntegrationSessionId)}
                            onAudioOverride={(enabled) => console.warn("audioOverride", enabled)}
                        />
                    </div>
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
