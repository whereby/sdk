import * as React from "react";
import {
    CURRENT_CAMERA_CHANGED,
    CURRENT_MICROPHONE_CHANGED,
    CURRENT_SPEAKER_CHANGED,
    LocalMediaState,
} from "@whereby.com/core";
import { UseLocalMediaOptions, UseLocalMediaResult } from "./types";
import { WherebyContext } from "../Provider";
import { initialState } from "./initialState";

export function useLocalMedia(
    optionsOrStream: UseLocalMediaOptions | MediaStream = { audio: true, video: true },
): UseLocalMediaResult {
    const client = React.useContext(WherebyContext)?.getLocalMediaClient();
    const [localMediaState, setLocalMediaState] = React.useState<LocalMediaState>(() => initialState);

    if (!client) {
        throw new Error("WherebyClient is not initialized. Please wrap your component with WherebyProvider.");
    }

    const handleCurrentCameraDeviceChanged = React.useCallback((cameraDeviceId: string | null) => {
        setLocalMediaState((prev) => ({
            ...prev,
            cameraDeviceId,
        }));
    }, []);

    const handleCurrentMicrophoneDeviceChanged = React.useCallback((microphoneDeviceId: string | null) => {
        setLocalMediaState((prev) => ({
            ...prev,
            microphoneDeviceId,
        }));
    }, []);

    const handleCurrentSpeakerDeviceChanged = React.useCallback((speakerDeviceId: string | null) => {
        setLocalMediaState((prev) => ({
            ...prev,
            speakerDeviceId,
        }));
    }, []);

    React.useEffect(() => {
        client.startMedia(optionsOrStream);

        client.on(CURRENT_CAMERA_CHANGED, handleCurrentCameraDeviceChanged);
        client.on(CURRENT_MICROPHONE_CHANGED, handleCurrentMicrophoneDeviceChanged);
        client.on(CURRENT_SPEAKER_CHANGED, handleCurrentSpeakerDeviceChanged);

        return () => {
            client.destroy();
        };
    }, []);

    const setCameraDevice = React.useCallback((deviceId: string) => client.setCameraDevice(deviceId), [client]);
    const setMicrophoneDevice = React.useCallback((deviceId: string) => client.setMicrophoneDevice(deviceId), [client]);
    const setSpeakerDevice = React.useCallback((deviceId: string) => client.setSpeakerDevice(deviceId), [client]);
    const toggleCamera = React.useCallback((enabled?: boolean) => client.toggleCamera(enabled), [client]);
    const toggleMicrophone = React.useCallback((enabled?: boolean) => client.toggleMicrophone(enabled), [client]);
    const toggleLowDataMode = React.useCallback((enabled?: boolean) => client.toggleLowDataMode(enabled), [client]);

    return {
        state: localMediaState,
        actions: {
            setCameraDevice,
            setMicrophoneDevice,
            setSpeakerDevice,
            toggleCameraEnabled: toggleCamera,
            toggleMicrophoneEnabled: toggleMicrophone,
            toggleLowDataModeEnabled: toggleLowDataMode,
        },
    };
}
