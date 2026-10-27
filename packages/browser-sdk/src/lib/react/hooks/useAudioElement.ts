import * as React from "react";
import { WherebyContext } from "../Provider";
import { CURRENT_SPEAKER_CHANGED } from "@whereby.com/core";
import adapterRaw from "webrtc-adapter";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;
const isSafari = adapter.browserDetails?.browser === "safari";

export type AudioElement = HTMLAudioElement & { setSinkId?: (deviceId: string) => void };
export const useAudioElement = ({ stream, muted }: { stream?: MediaStream | null; muted?: boolean }) => {
    const audioEl = React.useRef<AudioElement>(null);
    const client = React.useContext(WherebyContext)?.getLocalMedia();
    const [currentSpeakerId, setCurrentSpeakerId] = React.useState<string | undefined>(
        client?.getState().currentSpeakerDeviceId ?? "default",
    );

    const listener = React.useCallback((speakerId?: string) => {
        setCurrentSpeakerId(speakerId);
    }, []);

    React.useEffect(() => {
        client?.addListener(CURRENT_SPEAKER_CHANGED, listener);

        return () => {
            client?.removeListener(CURRENT_SPEAKER_CHANGED, listener);
        };
    }, [client]);

    React.useEffect(() => {
        if (!audioEl.current || muted || !stream || !currentSpeakerId) {
            return;
        }

        if (audioEl.current.srcObject !== stream) {
            audioEl.current.srcObject = stream;
        }

        // Safari 27 won't autoplay an <audio> element that has no renderer (WebKit bug 326969),
        // so start playback explicitly.
        if (isSafari) {
            audioEl.current.play().catch((err) => {
                console.warn(`Failed to start audio playback: ${err}`);
            });
        }

        if (audioEl.current.setSinkId) {
            audioEl.current.setSinkId(currentSpeakerId).catch((err) => {
                console.warn(`Failed to set audio output device: ${err}`);
                return;
            });
        }
    }, [stream, audioEl, currentSpeakerId, muted]);

    return audioEl;
};
