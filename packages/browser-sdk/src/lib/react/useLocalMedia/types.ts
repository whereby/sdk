import { LocalMediaOptions } from "@whereby.com/core";

export interface LocalMediaState {
    currentCameraDeviceId?: string;
    currentMicrophoneDeviceId?: string;
    currentSpeakerDeviceId?: string;
    cameraDeviceError: unknown;
    cameraDevices: MediaDeviceInfo[];
    isSettingCameraDevice: boolean;
    isSettingMicrophoneDevice: boolean;
    isStarting: boolean;
    localStream?: MediaStream;
    microphoneDeviceError: unknown;
    microphoneDevices: MediaDeviceInfo[];
    speakerDevices: MediaDeviceInfo[];
    startError: unknown;
}

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
