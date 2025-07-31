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

        client.subscribeCameraDevices((cameraDevices) => {
            setLocalMediaState((prev) => ({
                ...prev,
                cameraDevices,
            }));
        });
        client.subscribeMicrophoneDevices((microphoneDevices) => {
            setLocalMediaState((prev) => ({
                ...prev,
                microphoneDevices,
            }));
        });
        client.subscribeSpeakerDevices((speakerDevices) => {
            setLocalMediaState((prev) => ({
                ...prev,
                speakerDevices,
            }));
        });
        client.subscribeCameraDeviceError((error) => {
            setLocalMediaState((prev) => ({
                ...prev,
                cameraDeviceError: error,
            }));
        });
        client.subscribeMicrophoneDeviceError((error) => {
            setLocalMediaState((prev) => ({
                ...prev,
                microphoneDeviceError: error,
            }));
        });

        client.subscribeLocalStream((stream) => {
            setLocalMediaState((prev) => ({
                ...prev,
                localStream: stream,
            }));
        });

        client.subscribeLocalMediaStartError((error) => {
            setLocalMediaState((prev) => ({
                ...prev,
                startError: error,
            }));
        });

        client.subscribeIsSettingCameraDevice((isSetting) => {
            setLocalMediaState((prev) => ({
                ...prev,
                isSettingCameraDevice: isSetting,
            }));
        });

        client.subscribeIsSettingMicrophoneDevice((isSetting) => {
            setLocalMediaState((prev) => ({
                ...prev,
                isSettingMicrophoneDevice: isSetting,
            }));
        });

        client.subscribeLocalMediaStarting((isStarting) => {
            setLocalMediaState((prev) => ({
                ...prev,
                isStarting,
            }));
        });

        client.subscribeCurrentCamera((deviceId) => {
            setLocalMediaState((prev) => ({
                ...prev,
                currentCameraDeviceId: deviceId,
            }));
        });

        client.subscribeCurrentMicrophone((deviceId) => {
            setLocalMediaState((prev) => ({
                ...prev,
                currentMicrophoneDeviceId: deviceId,
            }));
        });

        client.subscribeCurrentSpeaker((speakerId) => {
            setLocalMediaState((prev) => ({
                ...prev,
                currentSpeakerDeviceId: speakerId,
            }));
        });

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
