import { LocalMediaOptions, LocalMediaState } from "@whereby.com/core";

interface LocalMediaActions {
    setCameraDevice: (deviceId: string) => void;
    setMicrophoneDevice: (deviceId: string) => void;
    setSpeakerDevice: (deviceId: string) => void;
    toggleCameraEnabled: (enabled?: boolean) => void;
    toggleMicrophoneEnabled: (enabled?: boolean) => void;
    toggleLowDataModeEnabled: (enabled?: boolean) => void;
}

export type UseLocalMediaResult = { state: LocalMediaState; actions: LocalMediaActions };

export type UseLocalMediaOptions = LocalMediaOptions;
