import * as React from "react";
import { RoomIntegrationProps, RoomIntegrationSessionView } from "@whereby.com/core";

import { WherebyContext } from "../Provider";

const HOST_TO_FRAME = {
    PROPS: "whereby:props",
    SET_VOLUME: "whereby:setVolume",
    GET_VOLUME: "whereby:getVolume",
} as const;

const FRAME_TO_HOST = {
    FRAME_READY: "whereby:frameReady",
    UPDATE_PROPS: "whereby:updateProps",
    CONTENT_READY: "whereby:contentReady",
    CLOSE: "whereby:close",
    AUDIO_OVERRIDE: "whereby:audioOverride",
    VOLUME: "whereby:volume",
} as const;

/** YouTube needs autoplay and encrypted-media; fullscreen is for the consumer's own controls. */
const DEFAULT_ALLOW = "autoplay; fullscreen; encrypted-media; picture-in-picture";

const VOLUME_REQUEST_TIMEOUT = 2000;

export interface RoomIntegrationViewHandle {
    getVolume: () => Promise<number>;
    setVolume: (volume: number) => void;
}

export interface RoomIntegrationViewProps {
    session: RoomIntegrationSessionView;
    onAudioOverride?: (enabled: boolean | null) => void;
    onContentReady?: () => void;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    allow?: string;
}

function outboundProps(session: RoomIntegrationSessionView): RoomIntegrationProps {
    return {
        ...session.props,
        ispresenter: session.isPresenter,
        presenterdisplayname: session.presenterDisplayName,
        roomintegrationsessionid: session.roomIntegrationSessionId,
        breakoutgroupid: session.breakoutGroupId,
    };
}

/**
 * Only the keys that changed, so we do not re-trigger `attributeChangedCallback` for values the
 * frame already has. Echoing an unchanged `seek` back would make YouTube seek again.
 */
function diffProps(next: RoomIntegrationProps, previous: RoomIntegrationProps | null): RoomIntegrationProps {
    if (!previous) {
        return next;
    }
    return Object.keys(next).reduce<RoomIntegrationProps>((patch, key) => {
        if (previous[key] !== next[key]) {
            patch[key] = next[key];
        }
        return patch;
    }, {});
}

/**
 * Renders a running room integration by embedding the integration's standalone webview and
 * syncing state with it over postMessage.
 *
 * The SDK runs on third-party origins, so it cannot import the integration entrypoint into the
 * consumer's document the way the Whereby app does. Instead the webview owns the content element
 * and this component drives it.
 *
 * Prop updates coming *from* the frame are sent to the room, and arrive back through the store —
 * this component is not the source of truth for integration state.
 */
export const RoomIntegrationView = React.forwardRef<RoomIntegrationViewHandle, RoomIntegrationViewProps>(
    function RoomIntegrationView(
        { session, onAudioOverride, onContentReady, className, style, title, allow = DEFAULT_ALLOW },
        ref,
    ) {
        const client = React.useContext(WherebyContext)?.getRoomConnection();
        const iframeRef = React.useRef<HTMLIFrameElement>(null);
        const lastSentRef = React.useRef<RoomIntegrationProps | null>(null);
        const isFrameReadyRef = React.useRef(false);
        const volumeRequestsRef = React.useRef(new Map<number, (volume: number) => void>());
        const nextRequestIdRef = React.useRef(0);

        const sessionRef = React.useRef(session);
        const onAudioOverrideRef = React.useRef(onAudioOverride);
        const onContentReadyRef = React.useRef(onContentReady);
        sessionRef.current = session;
        onAudioOverrideRef.current = onAudioOverride;
        onContentReadyRef.current = onContentReady;

        const { webview } = session.integration;
        const { roomIntegrationSessionId } = session;

        const frameOrigin = React.useMemo(() => {
            try {
                return new URL(webview).origin;
            } catch {
                console.warn(`RoomIntegrationView: unusable webview url ${webview}`);
                return null;
            }
        }, [webview]);

        // Changing this reloads the frame, so it must depend only on frame identity — never on
        // props, which are synced over postMessage instead.
        const src = React.useMemo(() => {
            if (!frameOrigin) {
                return null;
            }
            const url = new URL(webview);
            url.searchParams.set("parentOrigin", window.location.origin);
            url.searchParams.set("roomintegrationsessionid", roomIntegrationSessionId);
            return url.href;
        }, [webview, frameOrigin, roomIntegrationSessionId]);

        const post = React.useCallback(
            (type: string, payload?: unknown) => {
                const frameWindow = iframeRef.current?.contentWindow;
                if (!frameWindow || !frameOrigin) {
                    return;
                }
                frameWindow.postMessage({ type, payload }, frameOrigin);
            },
            [frameOrigin],
        );

        React.useEffect(() => {
            isFrameReadyRef.current = false;
            lastSentRef.current = null;
        }, [src]);

        React.useEffect(() => {
            if (!frameOrigin) {
                return;
            }

            const handleMessage = (event: MessageEvent) => {
                if (event.origin !== frameOrigin || event.source !== iframeRef.current?.contentWindow) {
                    return;
                }

                const { type, payload } = event.data || {};
                const currentSession = sessionRef.current;

                switch (type) {
                    case FRAME_TO_HOST.FRAME_READY: {
                        const props = outboundProps(currentSession);
                        isFrameReadyRef.current = true;
                        lastSentRef.current = props;
                        post(HOST_TO_FRAME.PROPS, props);
                        break;
                    }
                    case FRAME_TO_HOST.UPDATE_PROPS: {
                        if (payload?.props) {
                            client?.updateRoomIntegrationProps({
                                roomIntegrationSessionId: currentSession.roomIntegrationSessionId,
                                props: payload.props,
                            });
                        }
                        break;
                    }
                    case FRAME_TO_HOST.CLOSE: {
                        if (currentSession.canStop) {
                            client?.stopRoomIntegration({
                                roomIntegrationSessionId: currentSession.roomIntegrationSessionId,
                                intent: "end",
                            });
                        }
                        break;
                    }
                    case FRAME_TO_HOST.AUDIO_OVERRIDE: {
                        onAudioOverrideRef.current?.(payload?.enabled ?? null);
                        break;
                    }
                    case FRAME_TO_HOST.CONTENT_READY: {
                        onContentReadyRef.current?.();
                        break;
                    }
                    case FRAME_TO_HOST.VOLUME: {
                        const resolve = volumeRequestsRef.current.get(payload?.requestId);
                        if (resolve) {
                            volumeRequestsRef.current.delete(payload.requestId);
                            resolve(payload.volume);
                        }
                        break;
                    }
                }
            };

            window.addEventListener("message", handleMessage);
            return () => window.removeEventListener("message", handleMessage);
        }, [frameOrigin, client, post]);

        const serializedProps = JSON.stringify(outboundProps(session));
        React.useEffect(() => {
            if (!isFrameReadyRef.current) {
                return;
            }
            const props = outboundProps(sessionRef.current);
            const patch = diffProps(props, lastSentRef.current);
            lastSentRef.current = props;

            if (Object.keys(patch).length) {
                post(HOST_TO_FRAME.PROPS, patch);
            }
        }, [serializedProps, post]);

        React.useImperativeHandle(
            ref,
            () => ({
                setVolume: (volume: number) => post(HOST_TO_FRAME.SET_VOLUME, { volume }),
                getVolume: () =>
                    new Promise<number>((resolve, reject) => {
                        const requestId = ++nextRequestIdRef.current;
                        const requests = volumeRequestsRef.current;

                        const timer = setTimeout(() => {
                            requests.delete(requestId);
                            reject(new Error("Timed out reading volume from the room integration"));
                        }, VOLUME_REQUEST_TIMEOUT);

                        requests.set(requestId, (volume) => {
                            clearTimeout(timer);
                            resolve(volume);
                        });

                        post(HOST_TO_FRAME.GET_VOLUME, { requestId });
                    }),
            }),
            [post],
        );

        if (!src) {
            return null;
        }

        return (
            <iframe
                ref={iframeRef}
                src={src}
                title={title || session.integration.title}
                allow={allow}
                allowFullScreen
                className={className}
                style={{ border: "none", width: "100%", height: "100%", ...style }}
            />
        );
    },
);
