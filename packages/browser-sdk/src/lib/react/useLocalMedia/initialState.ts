import { LocalMediaState } from "@whereby.com/core";

export const initialState: LocalMediaState = {
    cameraDeviceError: null,
    cameraPermission: null,
    isCameraEnabled: false,
    isMicrophoneEnabled: false,
    isStarting: false,
    isSettingCameraDevice: false,
    isSettingMicrophoneDevice: false,
    microphoneDeviceError: null,
    microphonePermission: null,
    startError: null,
    cameraDevices: [],
    microphoneDevices: [],
    speakerDevices: [],
};
