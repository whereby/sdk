import { useEffect, useRef } from "react";
import { useAppSelector } from "../Provider/hooks";
import { selectCurrentSpeakerDeviceId } from "@whereby.com/core";

export type AudioElement = HTMLAudioElement & { setSinkId?: (deviceId: string) => void };
export const useAudioElement = ({ stream, muted }: { stream?: MediaStream | null; muted?: boolean }) => {
    const audioEl = useRef<AudioElement>(null);
    const currentSpeakerId = useAppSelector(selectCurrentSpeakerDeviceId);

    useEffect(() => {
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
