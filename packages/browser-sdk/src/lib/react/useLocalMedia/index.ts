import * as React from "react";
import { LocalMediaState } from "@whereby.com/core";
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

    React.useEffect(() => {
        client.startMedia(optionsOrStream);

        const unsubscribe = client.subscribe((state) => {
            setLocalMediaState((prevState) => ({
                ...prevState,
                ...state,
            }));
        });

        return () => {
            unsubscribe();
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
