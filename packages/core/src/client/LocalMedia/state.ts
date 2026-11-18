import {
    selectCameraDeviceError,
    selectCameraDevices,
    selectCurrentCameraDeviceId,
    selectCurrentMicrophoneDeviceId,
    selectCurrentSpeakerDeviceId,
    selectIsCameraEnabled,
    selectIsLocalMediaStarting,
    selectIsMicrophoneEnabled,
    selectIsSettingCameraDevice,
    selectIsSettingMicrophoneDevice,
    selectLocalMediaStartError,
    selectLocalMediaStream,
    selectMicrophoneDeviceError,
    selectMicrophoneDevices,
    selectSpeakerDevices,
} from "../../redux";
import type { StateDefinition } from "../BaseClient";
import {
    CAMERA_DEVICE_ERROR_CHANGED,
    CAMERA_DEVICES_CHANGED,
    CAMERA_ENABLED_CHANGED,
    MICROPHONE_ENABLED_CHANGED,
    CURRENT_CAMERA_CHANGED,
    CURRENT_MICROPHONE_CHANGED,
    CURRENT_SPEAKER_CHANGED,
    IS_SETTING_CAMERA_DEVICE,
    IS_SETTING_MICROPHONE_DEVICE,
    LOCAL_MEDIA_START_ERROR_CHANGED,
    LOCAL_MEDIA_STARTING,
    LOCAL_STREAM_CHANGED,
    MICROPHONE_DEVICE_ERROR_CHANGED,
    MICROPHONE_DEVICES_CHANGED,
    SPEAKER_DEVICES_CHANGED,
    type LocalMediaEvents,
} from "./events";
import type { LocalMediaState } from "./types";

export const localMediaStateDefinition: StateDefinition<LocalMediaState, LocalMediaEvents> = {
    cameraDeviceError: {
        selector: selectCameraDeviceError,
        emit: (emit, error) => emit(CAMERA_DEVICE_ERROR_CHANGED, error),
    },
    cameraDevices: {
        selector: selectCameraDevices,
        emit: (emit, devices) => emit(CAMERA_DEVICES_CHANGED, devices),
    },
    isCameraEnabled: {
        selector: selectIsCameraEnabled,
        emit: (emit, isCameraEnabled) => emit(CAMERA_ENABLED_CHANGED, isCameraEnabled),
    },
    isMicrophoneEnabled: {
        selector: selectIsMicrophoneEnabled,
        emit: (emit, isMicrophoneEnabled) => emit(MICROPHONE_ENABLED_CHANGED, isMicrophoneEnabled),
    },
    isSettingCameraDevice: {
        selector: selectIsSettingCameraDevice,
        emit: (emit, isSetting) => emit(IS_SETTING_CAMERA_DEVICE, isSetting),
    },
    isSettingMicrophoneDevice: {
        selector: selectIsSettingMicrophoneDevice,
        emit: (emit, isSetting) => emit(IS_SETTING_MICROPHONE_DEVICE, isSetting),
    },
    microphoneDeviceError: {
        selector: selectMicrophoneDeviceError,
        emit: (emit, error) => emit(MICROPHONE_DEVICE_ERROR_CHANGED, error),
    },
    microphoneDevices: {
        selector: selectMicrophoneDevices,
        emit: (emit, devices) => emit(MICROPHONE_DEVICES_CHANGED, devices),
    },
    speakerDevices: {
        selector: selectSpeakerDevices,
        emit: (emit, devices) => emit(SPEAKER_DEVICES_CHANGED, devices),
    },
    currentCameraDeviceId: {
        selector: selectCurrentCameraDeviceId,
        emit: (emit, deviceId) => emit(CURRENT_CAMERA_CHANGED, deviceId),
    },
    currentMicrophoneDeviceId: {
        selector: selectCurrentMicrophoneDeviceId,
        emit: (emit, deviceId) => emit(CURRENT_MICROPHONE_CHANGED, deviceId),
    },
    currentSpeakerDeviceId: {
        selector: selectCurrentSpeakerDeviceId,
        emit: (emit, deviceId) => emit(CURRENT_SPEAKER_CHANGED, deviceId),
    },
    isStarting: {
        selector: selectIsLocalMediaStarting,
        emit: (emit, isStarting) => emit(LOCAL_MEDIA_STARTING, isStarting),
    },
    localStream: {
        selector: selectLocalMediaStream,
        emit: (emit, stream) => emit(LOCAL_STREAM_CHANGED, stream),
    },
    startError: {
        selector: selectLocalMediaStartError,
        emit: (emit, error) => emit(LOCAL_MEDIA_START_ERROR_CHANGED, error),
    },
};
