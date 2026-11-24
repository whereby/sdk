import type { DevicePermissionState } from "../../redux";

export interface LocalMediaState {
    currentCameraDeviceId?: string;
    currentMicrophoneDeviceId?: string;
    currentSpeakerDeviceId?: string;
    cameraDeviceError: unknown;
    cameraDevices: MediaDeviceInfo[];
    cameraPermission: DevicePermissionState | null;
    isCameraEnabled: boolean;
    isMicrophoneEnabled: boolean;
    isSettingCameraDevice: boolean;
    isSettingMicrophoneDevice: boolean;
    isStarting: boolean;
    localStream?: MediaStream;
    microphoneDeviceError: unknown;
    microphoneDevices: MediaDeviceInfo[];
    microphonePermission: DevicePermissionState | null;
    speakerDevices: MediaDeviceInfo[];
    startError: unknown;
}
