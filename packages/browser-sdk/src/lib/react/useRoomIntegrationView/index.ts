import * as React from "react";
import { RoomIntegrationProps, RoomIntegrationSessionView } from "@whereby.com/core";

import { WherebyContext } from "../Provider";
import { useIframeContract } from "../useIframeContract";
import type { RoomIntegrationIframeProps } from "../useRoomIntegrationPicker";

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

const DEFAULT_ALLOW = "autoplay; fullscreen; encrypted-media; picture-in-picture";

const VOLUME_REQUEST_TIMEOUT = 2000;

export interface UseRoomIntegrationViewOptions {
    session: RoomIntegrationSessionView;
    onAudioOverride?: (enabled: boolean | null) => void;
    onContentReady?: () => void;
    allow?: string;
    title?: string;
}

export interface UseRoomIntegrationViewResult {
    /**
     * Spread onto an `<iframe>` you render and size yourself. Null when the integration's webview
     * url is unusable, in which case render nothing.
     */
    iframeProps: RoomIntegrationIframeProps | null;
    getVolume: () => Promise<number>;
    setVolume: (volume: number) => void;
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
 * Drives a running room integration in an iframe you render.
 *
 * The SDK runs on third-party origins, so it cannot import the integration entrypoint into the
 * consumer's document the way the Whereby app does. Instead the webview owns the content element
 * and this hook drives it: it waits for the frame to announce itself, sends the session's props,
 * and thereafter sends only what changed.
 *
 * Prop updates coming *from* the frame are sent to the room and arrive back through the store, so
 * this hook is not the source of truth for integration state.
 *
 * ```tsx
 * const { iframeProps } = useRoomIntegrationView({ session });
 *
 * return iframeProps ? <iframe {...iframeProps} allowFullScreen className="my-stage" /> : null;
 * ```
 */
export function useRoomIntegrationView({
    session,
    onAudioOverride,
    onContentReady,
    allow = DEFAULT_ALLOW,
    title,
}: UseRoomIntegrationViewOptions): UseRoomIntegrationViewResult {
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
            console.warn(`useRoomIntegrationView: unusable webview url ${webview}`);
            return null;
        }
    }, [webview]);

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

    const setVolume = React.useCallback((volume: number) => post(HOST_TO_FRAME.SET_VOLUME, { volume }), [post]);

    const getVolume = React.useCallback(
        () =>
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
        [post],
    );

    useIframeContract(iframeRef, "useRoomIntegrationView", !!src);

    return {
        iframeProps: src
            ? {
                  ref: iframeRef,
                  src,
                  title: title || session.integration.title,
                  allow,
              }
            : null,
        getVolume,
        setVolume,
    };
}
