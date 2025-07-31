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
