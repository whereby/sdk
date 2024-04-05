import * as React from "react";
import {
    observeStore,
    setCurrentCameraDeviceId,
    setCurrentMicrophoneDeviceId,
    setCurrentSpeakerDeviceId,
    doStartLocalMedia,
    doStopLocalMedia,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
} from "@whereby.com/core";

import { LocalMediaState, UseLocalMediaOptions, UseLocalMediaResult } from "./types";
import { selectLocalMediaState } from "./selector";
import { WherebyContext } from "../Provider";

const initialState: LocalMediaState = {
    cameraDeviceError: null,
    cameraDevices: [],
    isSettingCameraDevice: false,
    isSettingMicrophoneDevice: false,
    isStarting: false,
    microphoneDeviceError: null,
    microphoneDevices: [],
    speakerDevices: [],
    startError: null,
};

export function useLocalMedia(
    optionsOrStream: UseLocalMediaOptions | MediaStream = { audio: true, video: true },
): UseLocalMediaResult {
    const store = React.useContext(WherebyContext);

    if (!store) {
        throw new Error("useLocalMedia must be used within a WherebyProvider");
    }

    const [localMediaState, setLocalMediaState] = React.useState(initialState);

    React.useEffect(() => {
        const unsubscribe = observeStore(store, selectLocalMediaState, setLocalMediaState);
        store.dispatch(doStartLocalMedia(optionsOrStream));

        return () => {
            unsubscribe();
            store.dispatch(doStopLocalMedia());
        };
    }, []);

    const setCameraDevice = React.useCallback(
        (deviceId: string) => store.dispatch(setCurrentCameraDeviceId({ deviceId })),
        [store],
    );
    const setMicrophoneDevice = React.useCallback(
        (deviceId: string) => store.dispatch(setCurrentMicrophoneDeviceId({ deviceId })),
        [store],
    );
    const setSpeakerDevice = React.useCallback(
        (deviceId: string) => store.dispatch(setCurrentSpeakerDeviceId({ deviceId })),
        [store],
    );
    const toggleCamera = React.useCallback(
        (enabled?: boolean) => store.dispatch(toggleCameraEnabled({ enabled })),
        [store],
    );
    const toggleMicrophone = React.useCallback(
        (enabled?: boolean) => store.dispatch(toggleMicrophoneEnabled({ enabled })),
        [store],
    );
    return {
        state: localMediaState,
        actions: {
            setCameraDevice,
            setMicrophoneDevice,
            setSpeakerDevice,
            toggleCameraEnabled: toggleCamera,
            toggleMicrophoneEnabled: toggleMicrophone,
        },
        store,
    };
}
