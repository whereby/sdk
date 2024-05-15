import * as React from "react";
import {
    setCurrentCameraDeviceId,
    setCurrentMicrophoneDeviceId,
    setCurrentSpeakerDeviceId,
    doStartLocalMedia,
    doStopLocalMedia,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
    toggleLowDataModeEnabled,
} from "@whereby.com/core";
import { useAppDispatch, useAppSelector } from "../Provider/hooks";
import { UseLocalMediaOptions, UseLocalMediaResult } from "./types";
import { selectLocalMediaState } from "./selector";

export function useLocalMedia(
    optionsOrStream: UseLocalMediaOptions | MediaStream = { audio: true, video: true },
): UseLocalMediaResult {
    const dispatch = useAppDispatch();
    const localMediaState = useAppSelector(selectLocalMediaState);

    React.useEffect(() => {
        dispatch(doStartLocalMedia(optionsOrStream));

        return () => {
            dispatch(doStopLocalMedia());
        };
    }, []);

    const setCameraDevice = React.useCallback(
        (deviceId: string) => dispatch(setCurrentCameraDeviceId({ deviceId })),
        [dispatch],
    );
    const setMicrophoneDevice = React.useCallback(
        (deviceId: string) => dispatch(setCurrentMicrophoneDeviceId({ deviceId })),
        [dispatch],
    );
    const setSpeakerDevice = React.useCallback(
        (deviceId: string) => dispatch(setCurrentSpeakerDeviceId({ deviceId })),
        [dispatch],
    );
    const toggleCamera = React.useCallback(
        (enabled?: boolean) => dispatch(toggleCameraEnabled({ enabled })),
        [dispatch],
    );
    const toggleMicrophone = React.useCallback(
        (enabled?: boolean) => dispatch(toggleMicrophoneEnabled({ enabled })),
        [dispatch],
    );

    const toggleLowDataMode = React.useCallback(
        (enabled?: boolean) => dispatch(toggleLowDataModeEnabled({ enabled })),
        [dispatch],
    );
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
