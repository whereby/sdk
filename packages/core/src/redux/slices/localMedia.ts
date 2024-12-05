import { createSelector, createSlice, isAnyOf, PayloadAction } from "@reduxjs/toolkit";
import { getStream, getUpdatedDevices, getDeviceData } from "@whereby.com/media";
import { createAppAsyncThunk, createAppThunk } from "../thunk";
import { RootState } from "../store";
import { createReactor, startAppListening } from "../listenerMiddleware";
import { doAppStart, selectAppIsActive } from "./app";
import { debounce } from "../../utils";
import { signalEvents } from "./signalConnection/actions";

export type LocalMediaOptions = {
    audio: boolean;
    video: boolean;
};

/**
 * Reducer
 */
export interface LocalMediaState {
    busyDeviceIds: string[];
    cameraDeviceError?: unknown;
    cameraEnabled: boolean;
    currentCameraDeviceId?: string;
    currentMicrophoneDeviceId?: string;
    currentSpeakerDeviceId?: string;
    devices: MediaDeviceInfo[];
    isSettingCameraDevice: boolean;
    isSettingMicrophoneDevice: boolean;
    isSettingSpeakerDevice: boolean;
    isTogglingCamera: boolean;
    lowDataMode: boolean;
    microphoneDeviceError?: unknown;
    microphoneEnabled: boolean;
    speakerDeviceError?: unknown;
    options?: LocalMediaOptions;
    status: "inactive" | "stopped" | "starting" | "started" | "error";
    startError?: unknown;
    stream?: MediaStream;
    isSwitchingStream: boolean;
    onDeviceChange?: () => void;
}

export const initialLocalMediaState: LocalMediaState = {
    busyDeviceIds: [],
    cameraEnabled: false,
    currentSpeakerDeviceId: "default",
    devices: [],
    isSettingCameraDevice: false,
    isSettingMicrophoneDevice: false,
    isSettingSpeakerDevice: false,
    isTogglingCamera: false,
    lowDataMode: false,
    microphoneEnabled: false,
    status: "inactive",
    stream: undefined,
    isSwitchingStream: false,
};

export const localMediaSlice = createSlice({
    name: "localMedia",
    initialState: initialLocalMediaState,
    reducers: {
        deviceBusy(state, action: PayloadAction<{ deviceId: string }>) {
            if (state.busyDeviceIds.includes(action.payload.deviceId)) {
                return state;
            }

            return {
                ...state,
                busyDeviceIds: [...state.busyDeviceIds, action.payload.deviceId],
            };
        },
        toggleCameraEnabled(state, action: PayloadAction<{ enabled?: boolean }>) {
            return {
                ...state,
                cameraEnabled: action.payload.enabled ?? !state.cameraEnabled,
            };
        },
        setCurrentCameraDeviceId(state, action: PayloadAction<{ deviceId?: string }>) {
            return {
                ...state,
                currentCameraDeviceId: action.payload.deviceId,
            };
        },
        toggleMicrophoneEnabled(state, action: PayloadAction<{ enabled?: boolean }>) {
            return {
                ...state,
                microphoneEnabled: action.payload.enabled ?? !state.microphoneEnabled,
            };
        },
        setCurrentMicrophoneDeviceId(state, action: PayloadAction<{ deviceId?: string }>) {
            return {
                ...state,
                currentMicrophoneDeviceId: action.payload.deviceId,
            };
        },
        setCurrentSpeakerDeviceId(state, action: PayloadAction<{ deviceId?: string }>) {
            return {
                ...state,
                currentSpeakerDeviceId: action.payload.deviceId ?? "default",
            };
        },
        toggleLowDataModeEnabled(state, action: PayloadAction<{ enabled?: boolean }>) {
            return {
                ...state,
                lowDataMode: action.payload.enabled ?? !state.lowDataMode,
            };
        },
        setDevices(state, action: PayloadAction<{ devices: MediaDeviceInfo[] }>) {
            return {
                ...state,
                devices: action.payload.devices,
            };
        },
        setLocalMediaStream(state, action: PayloadAction<{ stream: MediaStream }>) {
            return {
                ...state,
                stream: action.payload.stream,
            };
        },
        setLocalMediaOptions(state, action: PayloadAction<{ options: LocalMediaOptions }>) {
            return {
                ...state,
                options: action.payload.options,
            };
        },
        localMediaStopped(state) {
            return {
                ...state,
                status: "stopped",
                stream: undefined,
            };
        },
        localStreamMetadataUpdated(state, action: PayloadAction<ReturnType<typeof getDeviceData>>) {
            const { audio, video } = action.payload;
            return {
                ...state,
                currentCameraDeviceId: video.deviceId,
                currentMicrophoneDeviceId: audio.deviceId,
                busyDeviceIds: state.busyDeviceIds.filter((id) => id !== audio.deviceId && id !== video.deviceId),
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(doAppStart, (state, action) => {
            return {
                ...state,
                options: action.payload.localMediaOptions,
            };
        });
        builder.addCase(doSetDevice.pending, (state, action) => {
            const { audio, video } = action.meta.arg;
            return {
                ...state,
                isSettingCameraDevice: video,
                isSettingMicrophoneDevice: audio,
            };
        });
        builder.addCase(doSetDevice.fulfilled, (state, action) => {
            const { audio, video } = action.meta.arg;
            return {
                ...state,
                isSettingCameraDevice: video ? false : state.isSettingCameraDevice,
                isSettingMicrophoneDevice: audio ? false : state.isSettingMicrophoneDevice,
            };
        });
        builder.addCase(doSetDevice.rejected, (state, action) => {
            const { audio, video } = action.meta.arg;
            return {
                ...state,
                isSettingCameraDevice: video ? false : state.isSettingCameraDevice,
                isSettingMicrophoneDevice: audio ? false : state.isSettingMicrophoneDevice,
                cameraDeviceError: video ? action.error : state.cameraDeviceError,
                microphoneDeviceError: audio ? action.error : state.microphoneDeviceError,
            };
        });
        builder.addCase(doToggleCamera.pending, (state) => {
            return {
                ...state,
                isTogglingCamera: true,
            };
        });
        builder.addCase(doToggleCamera.fulfilled, (state) => {
            return {
                ...state,
                isTogglingCamera: false,
            };
        });
        builder.addCase(doUpdateDeviceList.fulfilled, (state, action) => {
            return {
                ...state,
                devices: action.payload.devices,
            };
        });
        builder.addCase(doStartLocalMedia.pending, (state) => {
            return {
                ...state,
                status: "starting",
            };
        });
        builder.addCase(doStartLocalMedia.fulfilled, (state, { payload: { stream, onDeviceChange } }) => {
            let cameraDeviceId = undefined;
            let cameraEnabled = false;
            let microphoneDeviceId = undefined;
            let microphoneEnabled = false;

            const audioTrack = stream.getAudioTracks()[0];
            const videoTrack = stream.getVideoTracks()[0];

            if (audioTrack) {
                microphoneDeviceId = audioTrack.getSettings().deviceId;
                microphoneEnabled = audioTrack.enabled;
            }

            if (videoTrack) {
                cameraEnabled = videoTrack.enabled;
                cameraDeviceId = videoTrack.getSettings().deviceId;
            }

            return {
                ...state,
                stream,
                status: "started",
                currentCameraDeviceId: cameraDeviceId,
                currentMicrophoneDeviceId: microphoneDeviceId,
                cameraEnabled,
                microphoneEnabled,
                onDeviceChange,
            };
        });
        builder.addCase(doStartLocalMedia.rejected, (state, action) => {
            return {
                ...state,
                status: "error",
                startError: action.error,
            };
        });
        builder.addCase(doSwitchLocalStream.pending, (state) => {
            return {
                ...state,
                isSwitchingStream: true,
            };
        });
        builder.addCase(doSwitchLocalStream.fulfilled, (state) => {
            return {
                ...state,
                isSwitchingStream: false,
            };
        });
        builder.addCase(doSwitchLocalStream.rejected, (state) => {
            return {
                ...state,
                isSwitchingStream: false,
            };
        });
    },
});

/**
 * Action creators
 */

export const {
    deviceBusy,
    setCurrentCameraDeviceId,
    setCurrentMicrophoneDeviceId,
    setCurrentSpeakerDeviceId,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
    toggleLowDataModeEnabled,
    setLocalMediaOptions,
    setLocalMediaStream,
    localMediaStopped,
    localStreamMetadataUpdated,
} = localMediaSlice.actions;

export const doToggleCamera = createAppAsyncThunk(
    "localMedia/doToggleCamera",
    async (_, { getState, rejectWithValue }) => {
        const state = getState();
        const stream = selectLocalMediaStream(state);
        if (!stream) {
            return;
        }
        let track = stream.getVideoTracks()[0];
        const enabled = selectIsCameraEnabled(state);

        try {
            if (enabled) {
                if (track) {
                    // We have existing video track, just enable it
                    track.enabled = true;
                } else {
                    // We dont have video track, get new one
                    const constraintsOptions = selectLocalMediaConstraintsOptions(state);
                    const cameraDeviceId = selectCurrentCameraDeviceId(state);
                    await getStream(
                        {
                            ...constraintsOptions,
                            audioId: false,
                            videoId: cameraDeviceId,
                            type: "exact",
                        },
                        { replaceStream: stream },
                    );

                    track = stream.getVideoTracks()[0];
                }
            } else {
                if (!track) {
                    return;
                }

                track.enabled = false;
                track.stop();
                stream.removeTrack(track);
            }

            // Dispatch event on stream to allow RTC layer effects
            stream.dispatchEvent(new CustomEvent("stopresumevideo", { detail: { track, enable: enabled } }));
        } catch (error) {
            return rejectWithValue(error);
        }
    },
);

const doToggleMicrophone = createAppAsyncThunk("localMedia/doToggleMicrophone", (_, { getState }) => {
    const state = getState();
    const stream = selectLocalMediaStream(state);
    if (!stream) {
        return;
    }
    const enabled = selectIsMicrophoneEnabled(state);
    const audioTrack = stream.getAudioTracks()?.[0];
    if (!audioTrack) {
        return;
    }

    audioTrack.enabled = enabled;
});
export const doToggleLowDataMode = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const stream = selectLocalMediaStream(state);
    if (!stream) {
        return;
    }

    const videoId = selectCurrentCameraDeviceId(state);
    const audioId = selectCurrentMicrophoneDeviceId(state);

    dispatch(doSwitchLocalStream({ audioId, videoId }));
});

export const doSetDevice = createAppAsyncThunk(
    "localMedia/reactSetDevice",
    async ({ audio, video }: { audio: boolean; video: boolean }, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const stream = selectLocalMediaStream(state);
            if (!stream) {
                throw new Error("No stream");
            }
            const audioId = audio ? selectCurrentMicrophoneDeviceId(state) : false;
            const videoId = video ? selectCurrentCameraDeviceId(state) : false;
            const constraintsOptions = selectLocalMediaConstraintsOptions(state);

            const { replacedTracks } = await getStream(
                {
                    ...constraintsOptions,
                    audioId,
                    videoId,
                    type: "exact",
                },
                { replaceStream: stream },
            );

            const isAudioEnabled = selectIsMicrophoneEnabled(state);
            stream.getAudioTracks().forEach((track) => (track.enabled = isAudioEnabled));

            const isVideoEnabled = selectIsCameraEnabled(state);
            stream.getVideoTracks().forEach((track) => (track.enabled = isVideoEnabled));

            return { replacedTracks };
        } catch (error) {
            return rejectWithValue(error);
        }
    },
);

export const doUpdateDeviceList = createAppAsyncThunk(
    "localMedia/doUpdateDeviceList",
    async (_, { getState, dispatch, rejectWithValue }) => {
        const state = getState();
        let newDevices: MediaDeviceInfo[] = [];
        let oldDevices: MediaDeviceInfo[] = [];
        const stream = selectLocalMediaStream(state);
        try {
            newDevices = await navigator.mediaDevices.enumerateDevices();
            oldDevices = selectLocalMediaDevices(state);

            const shouldHandleDeviceUpdate =
                stream &&
                !selectLocalMediaIsSwitchingStream(state) &&
                newDevices &&
                oldDevices &&
                oldDevices.find((d) => d.deviceId);

            if (!shouldHandleDeviceUpdate) {
                return { devices: newDevices };
            }

            const { changedDevices, addedDevices } = getUpdatedDevices({
                oldDevices,
                newDevices,
            });

            let autoSwitchAudioId = changedDevices.audioinput?.deviceId;
            let autoSwitchVideoId = changedDevices.videoinput?.deviceId;

            // Handle added devices
            if (autoSwitchAudioId === undefined) {
                autoSwitchAudioId = addedDevices.audioinput?.deviceId;
            }
            if (autoSwitchVideoId === undefined) {
                autoSwitchVideoId = addedDevices.videoinput?.deviceId;
            }

            if (autoSwitchAudioId !== undefined || autoSwitchVideoId !== undefined) {
                dispatch(doSwitchLocalStream({ audioId: autoSwitchAudioId, videoId: autoSwitchVideoId }));
            }

            return { devices: newDevices };
        } catch (error) {
            return rejectWithValue(error);
        }
    },
);

export const doSwitchLocalStream = createAppAsyncThunk(
    "localMedia/doSwitchLocalStream",
    async (
        { audioId, videoId }: { audioId?: string | null; videoId?: string | null },
        { dispatch, getState, rejectWithValue },
    ) => {
        const state = getState();
        const replaceStream = selectLocalMediaStream(state);
        const constraintsOptions = selectLocalMediaConstraintsOptions(state);
        const onlySwitchingOne = !!(videoId && !audioId) || !!(!videoId && audioId);
        if (!replaceStream) {
            // Switching no stream makes no sense
            return;
        }

        try {
            const { replacedTracks } = await getStream(
                {
                    ...constraintsOptions,
                    audioId: audioId === undefined ? false : audioId,
                    videoId: videoId === undefined ? false : videoId,
                    type: "exact",
                },
                { replaceStream },
            );

            const deviceId = audioId || videoId;
            if (onlySwitchingOne && deviceId) {
                dispatch(
                    deviceBusy({
                        deviceId,
                    }),
                );
            }
            return { replacedTracks };
        } catch (error) {
            console.error(error);
            const deviceId = audioId || videoId;
            if (onlySwitchingOne && deviceId) {
                dispatch(
                    deviceBusy({
                        deviceId,
                    }),
                );
            }
            return rejectWithValue(error);
        }
    },
);

export const doStartLocalMedia = createAppAsyncThunk(
    "localMedia/doStartLocalMedia",
    async (payload: LocalMediaOptions | MediaStream, { getState, dispatch, rejectWithValue }) => {
        const onDeviceChange = debounce(
            () => {
                dispatch(doUpdateDeviceList());
            },
            { delay: 500 },
        );

        if (navigator.mediaDevices) {
            navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
        }

        // Resolve if existing stream is passed
        if ("getTracks" in payload) {
            return Promise.resolve({ stream: payload, onDeviceChange });
        }

        if (!(payload.audio || payload.video)) {
            return { stream: new MediaStream(), onDeviceChange };
        } else {
            dispatch(setLocalMediaOptions({ options: payload }));
        }

        try {
            // then update devices
            await dispatch(doUpdateDeviceList());
            // then get new state
            const state = getState();

            const constraintsOptions = selectLocalMediaConstraintsOptions(state);

            const { stream } = await getStream({
                ...constraintsOptions,
                audioId: payload.audio,
                videoId: payload.video,
            });

            return { stream, onDeviceChange };
        } catch (error) {
            return rejectWithValue(error);
        }
    },
);

export const doStopLocalMedia = createAppThunk(() => (dispatch, getState) => {
    const stream = selectLocalMediaStream(getState());
    const onDeviceChange = selectLocalMediaRaw(getState()).onDeviceChange;

    stream?.getTracks().forEach((track) => {
        track.stop();
    });

    if (navigator.mediaDevices && onDeviceChange) {
        navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
    }

    dispatch(localMediaStopped());
});

/**
 * Selectors
 */

export const selectBusyDeviceIds = (state: RootState) => state.localMedia.busyDeviceIds;
export const selectCameraDeviceError = (state: RootState) => state.localMedia.cameraDeviceError;
export const selectCurrentCameraDeviceId = (state: RootState) => state.localMedia.currentCameraDeviceId;
export const selectCurrentMicrophoneDeviceId = (state: RootState) => state.localMedia.currentMicrophoneDeviceId;
export const selectCurrentSpeakerDeviceId = (state: RootState) => state.localMedia.currentSpeakerDeviceId;
export const selectIsCameraEnabled = (state: RootState) => state.localMedia.cameraEnabled;
export const selectIsMicrophoneEnabled = (state: RootState) => state.localMedia.microphoneEnabled;
export const selectIsLowDataModeEnabled = (state: RootState) => state.localMedia.lowDataMode;
export const selectIsSettingCameraDevice = (state: RootState) => state.localMedia.isSettingCameraDevice;
export const selectIsSettingMicrophoneDevice = (state: RootState) => state.localMedia.isSettingMicrophoneDevice;
export const selectIsToggleCamera = (state: RootState) => state.localMedia.isTogglingCamera;
export const selectLocalMediaDevices = (state: RootState) => state.localMedia.devices;
export const selectLocalMediaOptions = (state: RootState) => state.localMedia.options;
export const selectLocalMediaOwnsStream = createSelector(selectLocalMediaOptions, (options) => !!options);
export const selectLocalMediaRaw = (state: RootState) => state.localMedia;
export const selectLocalMediaStatus = (state: RootState) => state.localMedia.status;
export const selectLocalMediaStream = (state: RootState) => state.localMedia.stream;
export const selectMicrophoneDeviceError = (state: RootState) => state.localMedia.microphoneDeviceError;
export const selectLocalMediaStartError = (state: RootState) => state.localMedia.startError;
export const selectLocalMediaIsSwitchingStream = (state: RootState) => state.localMedia.isSwitchingStream;
export const selectLocalMediaConstraintsOptions = createSelector(
    selectLocalMediaDevices,
    selectCurrentCameraDeviceId,
    selectCurrentMicrophoneDeviceId,
    selectIsLowDataModeEnabled,
    (devices, videoId, audioId, lowDataMode) => ({
        devices,
        videoId,
        audioId,
        options: {
            disableAEC: false,
            disableAGC: false,
            hd: true,
            lax: false,
            lowDataMode,
            simulcast: true,
            widescreen: true,
        },
    }),
);
export const selectIsLocalMediaStarting = createSelector(selectLocalMediaStatus, (status) => status === "starting");
export const selectCameraDevices = createSelector(
    selectLocalMediaDevices,
    selectBusyDeviceIds,
    (devices, busyDeviceIds) =>
        devices.filter((d) => d.kind === "videoinput").filter((d) => !busyDeviceIds.includes(d.deviceId)),
);
export const selectMicrophoneDevices = createSelector(
    selectLocalMediaDevices,
    selectBusyDeviceIds,
    (devices, busyDeviceIds) =>
        devices.filter((d) => d.kind === "audioinput").filter((d) => !busyDeviceIds.includes(d.deviceId)),
);
export const selectSpeakerDevices = createSelector(selectLocalMediaDevices, (devices) =>
    devices.filter((d) => d.kind === "audiooutput"),
);

/**
 * Reactors
 */

// Start localMedia unless started when roomConnection is wanted
export const selectLocalMediaShouldStartWithOptions = createSelector(
    selectAppIsActive,
    selectLocalMediaStatus,
    selectLocalMediaOptions,
    (appIsActive, localMediaStatus, localMediaOptions) => {
        if (appIsActive && ["inactive", "stopped"].includes(localMediaStatus) && localMediaOptions) {
            return localMediaOptions;
        }
    },
);

createReactor([selectLocalMediaShouldStartWithOptions], ({ dispatch }, options) => {
    if (options) {
        dispatch(doStartLocalMedia(options));
    }
});

// Stop localMedia when roomConnection is no longer wanted and media was started when joining
export const selectLocalMediaShouldStop = createSelector(
    selectAppIsActive,
    selectLocalMediaStatus,
    selectLocalMediaOptions,
    (appIsActive, localMediaStatus, localMediaOptions) => {
        return !appIsActive && localMediaStatus !== "inactive" && !!localMediaOptions;
    },
);

createReactor([selectLocalMediaShouldStop], ({ dispatch }, localMediaShouldStop) => {
    if (localMediaShouldStop) {
        dispatch(doStopLocalMedia());
    }
});

startAppListening({
    predicate: (_action, currentState, previousState) => {
        const oldValue = selectIsMicrophoneEnabled(previousState);
        const newValue = selectIsMicrophoneEnabled(currentState);
        const isReady = selectLocalMediaStatus(previousState) === "started";
        return isReady && oldValue !== newValue;
    },
    effect: (_, { dispatch }) => {
        dispatch(doToggleMicrophone());
    },
});

startAppListening({
    predicate: (_action, currentState, previousState) => {
        const oldValue = selectIsLowDataModeEnabled(previousState);
        const newValue = selectIsLowDataModeEnabled(currentState);

        const isReady = selectLocalMediaStatus(previousState) === "started";
        return isReady && oldValue !== newValue;
    },
    effect: (_action, { dispatch }) => {
        dispatch(doToggleLowDataMode());
    },
});

startAppListening({
    predicate: (_action, currentState, previousState) => {
        const isToggling = selectIsToggleCamera(currentState);
        if (isToggling) {
            return false;
        }
        const oldValue = selectIsCameraEnabled(previousState);
        const newValue = selectIsCameraEnabled(currentState);
        const isReady = selectLocalMediaStatus(previousState) === "started";
        return isReady && oldValue !== newValue;
    },
    effect: (_action, { dispatch }) => {
        dispatch(doToggleCamera());
    },
});

startAppListening({
    predicate: (_action, currentState, previousState) => {
        const oldValue = selectCurrentCameraDeviceId(previousState);
        const newValue = selectCurrentCameraDeviceId(currentState);
        const isReady = selectLocalMediaStatus(previousState) === "started";
        return isReady && oldValue !== newValue;
    },
    effect: (_action, { dispatch }) => {
        dispatch(doSetDevice({ audio: false, video: true }));
    },
});

startAppListening({
    predicate: (_action, currentState, previousState) => {
        const oldValue = selectCurrentMicrophoneDeviceId(previousState);
        const newValue = selectCurrentMicrophoneDeviceId(currentState);
        const isReady = selectLocalMediaStatus(previousState) === "started";
        return isReady && oldValue !== newValue;
    },
    effect: (_action, { dispatch }) => {
        dispatch(doSetDevice({ audio: true, video: false }));
    },
});

startAppListening({
    matcher: isAnyOf(
        doStartLocalMedia.fulfilled,
        doUpdateDeviceList.fulfilled,
        doSwitchLocalStream.fulfilled,
        doSwitchLocalStream.rejected,
    ),
    effect: (_action, { dispatch, getState }) => {
        const state = getState();
        const stream = selectLocalMediaStream(state);
        const devices = selectLocalMediaDevices(state);

        if (!stream) return;

        const deviceData = getDeviceData({
            audioTrack: stream.getAudioTracks()[0],
            videoTrack: stream.getVideoTracks()[0],
            devices,
        });

        dispatch(localStreamMetadataUpdated(deviceData));
    },
});

startAppListening({
    actionCreator: signalEvents.audioEnableRequested,
    effect: ({ payload }, { dispatch }) => {
        const { enable } = payload;

        // Only handle disable audio case automatically.
        // Enable audio case must be handled via `requestAudioEnable` notification
        if (!enable) {
            dispatch(toggleMicrophoneEnabled({ enabled: false }));
        }
    },
});

startAppListening({
    actionCreator: signalEvents.videoEnableRequested,
    effect: ({ payload }, { dispatch }) => {
        const { enable } = payload;

        // Only handle disable video case automatically.
        // Enable video case must be handled via `requestVideoEnable` notification
        if (!enable) {
            dispatch(toggleCameraEnabled({ enabled: false }));
        }
    },
});
