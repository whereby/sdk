import { createSelector } from "@reduxjs/toolkit";
import {
    selectCameraDeviceError,
    selectCameraDevices,
    selectCurrentCameraDeviceId,
    selectCurrentMicrophoneDeviceId,
    selectCurrentSpeakerDeviceId,
    selectIsLocalMediaStarting,
    selectIsSettingCameraDevice,
    selectIsSettingMicrophoneDevice,
    selectLocalMediaStartError,
    selectLocalMediaStream,
    selectMicrophoneDeviceError,
    selectMicrophoneDevices,
    selectSpeakerDevices,
} from "@whereby.com/core";

import { LocalMediaState } from "./types";

export const selectLocalMediaState = createSelector(
    selectCameraDeviceError,
    selectCameraDevices,
    selectCurrentCameraDeviceId,
    selectCurrentMicrophoneDeviceId,
    selectCurrentSpeakerDeviceId,
    selectIsSettingCameraDevice,
    selectIsSettingMicrophoneDevice,
    selectIsLocalMediaStarting,
    selectLocalMediaStream,
    selectMicrophoneDeviceError,
    selectMicrophoneDevices,
    selectSpeakerDevices,
    selectLocalMediaStartError,
    (
        cameraDeviceError,
        cameraDevices,
        currentCameraDeviceId,
        currentMicrophoneDeviceId,
        currentSpeakerDeviceId,
        isSettingCameraDevice,
        isSettingMicrophoneDevice,
        isStarting,
        localStream,
        microphoneDeviceError,
        microphoneDevices,
        speakerDevices,
        startError,
    ) => {
        const state: LocalMediaState = {
            cameraDeviceError,
            cameraDevices,
            currentCameraDeviceId,
            currentMicrophoneDeviceId,
            currentSpeakerDeviceId,
            isSettingCameraDevice,
            isSettingMicrophoneDevice,
            isStarting,
            localStream,
            microphoneDeviceError,
            microphoneDevices,
            speakerDevices,
            startError,
        };
        return state;
    },
);
