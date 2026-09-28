import * as React from "react";
import { RoomIntegration, RoomIntegrationPickerResult, roomIntegrationPickerUrl } from "@whereby.com/core";

import { subscribeToRoomIntegrationPicker } from "../../roomIntegrationPicker";
import { useIframeContract } from "../useIframeContract";

/**
 * The picker renders provider UI of its own: Miro's board picker, YouTube thumbnails. Clipboard
 * access is for the paste-a-link fields.
 *
 * Deliberately no `sandbox`. Some providers still open a window of their own to sign in, and a
 * sandbox without `allow-popups` breaks that with no error, which is why the hook warns in
 * development if the frame it is attached to has one.
 */
const DEFAULT_ALLOW = "clipboard-read; clipboard-write; fullscreen";

export interface RoomIntegrationIframeProps {
    ref: React.RefObject<HTMLIFrameElement | null>;
    src: string;
    title: string;
    allow: string;
}

export interface UseRoomIntegrationPickerOptions {
    integration: RoomIntegration;
    onPicked: (content: RoomIntegrationPickerResult) => void;
    onCancel?: () => void;
    onError?: (error: Error) => void;
    featureSource?: string;
    allow?: string;
    title?: string;
}

export interface UseRoomIntegrationPickerResult {
    /**
     * Spread onto an `<iframe>` you render and size yourself. Null when the integration's webview
     * url is unusable, in which case render nothing.
     */
    iframeProps: RoomIntegrationIframeProps | null;
}

/**
 * Drives an integration's own content picker in an iframe you render.
 *
 * Every pixel in that frame comes from the integration's origin, its styling, its session with the
 * provider, so this hook contributes no UI at all. What it owns is the part that is easy to get
 * wrong: building the url, and accepting the one answer that comes back only if it arrives from the
 * right origin *and* the right window.
 *
 * ```tsx
 * const { iframeProps } = useRoomIntegrationPicker({
 *     integration,
 *     onPicked: (content) => {
 *         actions.startRoomIntegration({ roomIntegrationId: integration.roomIntegrationId, ...content });
 *         setPicking(null);
 *     },
 *     onCancel: () => setPicking(null),
 * });
 *
 * return iframeProps ? <iframe {...iframeProps} className="my-picker" /> : null;
 * ```
 */
export function useRoomIntegrationPicker({
    integration,
    onPicked,
    onCancel,
    onError,
    featureSource,
    allow = DEFAULT_ALLOW,
    title,
}: UseRoomIntegrationPickerOptions): UseRoomIntegrationPickerResult {
    const iframeRef = React.useRef<HTMLIFrameElement>(null);

    const onPickedRef = React.useRef(onPicked);
    const onCancelRef = React.useRef(onCancel);
    const onErrorRef = React.useRef(onError);
    onPickedRef.current = onPicked;
    onCancelRef.current = onCancel;
    onErrorRef.current = onError;

    const { webview } = integration;

    const pickerOrigin = React.useMemo(() => {
        try {
            return new URL(webview).origin;
        } catch {
            console.warn(`useRoomIntegrationPicker: unusable webview url ${webview}`);
            return null;
        }
    }, [webview]);

    const src = React.useMemo(() => {
        if (!pickerOrigin) {
            return null;
        }
        return roomIntegrationPickerUrl({
            integration: { webview },
            parentOrigin: window.location.origin,
            featureSource,
        });
    }, [pickerOrigin, webview, featureSource]);

    React.useEffect(() => {
        if (!pickerOrigin) {
            return;
        }

        return subscribeToRoomIntegrationPicker({
            pickerOrigin,
            getSource: () => iframeRef.current?.contentWindow,
            onOutcome: (outcome) => {
                if (outcome.type === "submitted") {
                    onPickedRef.current(outcome.content || ({} as RoomIntegrationPickerResult));
                    return;
                }
                if (outcome.type === "cancelled") {
                    onCancelRef.current?.();
                    return;
                }
                onErrorRef.current?.(outcome.error);
            },
        });
    }, [pickerOrigin, src]);

    useIframeContract(iframeRef, "useRoomIntegrationPicker", !!src);

    return {
        iframeProps: src
            ? {
                  ref: iframeRef,
                  src,
                  title: title || `${integration.title} picker`,
                  allow,
              }
            : null,
    };
}
