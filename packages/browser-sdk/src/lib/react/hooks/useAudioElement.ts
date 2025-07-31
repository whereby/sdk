import * as React from "react";
import { WherebyContext } from "../Provider";
import { CURRENT_SPEAKER_CHANGED } from "@whereby.com/core";

export type AudioElement = HTMLAudioElement & { setSinkId?: (deviceId: string) => void };
export const useAudioElement = ({ stream, muted }: { stream?: MediaStream | null; muted?: boolean }) => {
    const audioEl = React.useRef<AudioElement>(null);
    const client = React.useContext(WherebyContext)?.getLocalMediaClient();
    const [currentSpeakerId, setCurrentSpeakerId] = React.useState<string | null>(null);

    const listener = React.useCallback((speakerId: string | null) => {
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

        if (audioEl.current.setSinkId) {
            audioEl.current.setSinkId(currentSpeakerId);
        }
    }, [stream, audioEl, currentSpeakerId, muted]);

    return audioEl;
};
