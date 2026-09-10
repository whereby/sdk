import { LocalMediaState } from "@whereby.com/core";

export const initialState: LocalMediaState = {
    cameraDeviceError: null,
    isCameraEnabled: false,
    isMicrophoneEnabled: false,
    isStarting: false,
    isSettingCameraDevice: false,
    isSettingMicrophoneDevice: false,
    microphoneDeviceError: null,
    startError: null,
    cameraDevices: [],
    microphoneDevices: [],
    speakerDevices: [],
};
