import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { createAppAsyncThunk } from "../thunk";
import { RootState } from "../store";
import { startAppListening } from "../listenerMiddleware";
import { doAppStop } from "./app";
import {
    doLocalStreamEffect,
    doSwitchLocalStream,
    selectLocalMediaIsSwitchingStream,
    selectLocalMediaStream,
} from "./localMedia";

type StopFn = () => void;

export interface AudioDenoiserState {
    /**
     * User intent — true if the consumer asked for denoising on. Persists
     * across mid-flight stops triggered by device/stream switches so we can
     * auto-reapply after the switch settles.
     */
    wanted: boolean;
    isSwitching: boolean;
    error?: unknown;
    raw: {
        stop?: StopFn;
        outputStream?: MediaStream;
        audioContext?: AudioContext;
        denoiserNode?: AudioWorkletNode;
    };
}

const initialState: AudioDenoiserState = {
    wanted: false,
    isSwitching: false,
    raw: {},
};

export const audioDenoiserSlice = createSlice({
    name: "audioDenoiser",
    initialState,
    reducers: {
        audioDenoiserSwitching(state, action: PayloadAction<{ isSwitching: boolean }>) {
            state.isSwitching = action.payload.isSwitching;
        },
        audioDenoiserWantedSet(state, action: PayloadAction<{ wanted: boolean }>) {
            state.wanted = action.payload.wanted;
        },
        audioDenoiserApplied(
            state,
            action: PayloadAction<{
                stop: StopFn;
                outputStream: MediaStream;
                audioContext: AudioContext;
                denoiserNode: AudioWorkletNode;
            }>,
        ) {
            // Cast bypasses Immer's WritableDraft expansion for AudioContext /
            // AudioWorkletNode (which expose ReadonlyMap-ish fields that Immer's
            // type mapper can't reconcile). Immer leaves class instances alone
            // at runtime, so this is type-level only.
            state.raw = action.payload as typeof state.raw;
            state.error = undefined;
            state.isSwitching = false;
        },
        audioDenoiserCleared(state) {
            state.raw = {};
            state.error = undefined;
            state.isSwitching = false;
        },
        audioDenoiserError(state, action: PayloadAction<{ error: unknown }>) {
            state.error = action.payload.error;
            state.isSwitching = false;
        },
    },
});

export const {
    audioDenoiserSwitching,
    audioDenoiserWantedSet,
    audioDenoiserApplied,
    audioDenoiserCleared,
    audioDenoiserError,
} = audioDenoiserSlice.actions;

export const selectAudioDenoiserRaw = (state: RootState) => state.audioDenoiser.raw;
export const selectAudioDenoiserWanted = (state: RootState) => state.audioDenoiser.wanted;
export const selectIsAudioDenoiserSwitching = (state: RootState) => state.audioDenoiser.isSwitching;
export const selectAudioDenoiserEnabled = (state: RootState) => !!state.audioDenoiser.raw.stop;
export const selectAudioDenoiserError = (state: RootState) => state.audioDenoiser.error;

const doAudioDenoiserApply = createAppAsyncThunk(
    "audioDenoiser/apply",
    async (_, { getState, dispatch, rejectWithValue }) => {
        const state = getState();
        if (selectLocalMediaIsSwitchingStream(state)) return;

        const localStream = selectLocalMediaStream(state);
        if (!localStream?.getAudioTracks()?.[0]) {
            // No audio input to wrap; nothing to do but stay in "wanted" so we
            // re-apply once a stream becomes available.
            return;
        }
        if (selectAudioDenoiserEnabled(state)) return;

        dispatch(audioDenoiserSwitching({ isSwitching: true }));
        try {
            let mod: typeof import("@whereby.com/audio-denoiser");
            try {
                mod = await import("@whereby.com/audio-denoiser");
            } catch {
                throw new Error(
                    "@whereby.com/audio-denoiser is not installed. Add it as a dependency to enable audio denoising.",
                );
            }

            const { applyAudioDenoiser, canUse } = mod;
            if (!canUse()) {
                throw new Error("Audio denoiser is not supported in this browser");
            }

            const handle = await applyAudioDenoiser({ inputStream: localStream });

            await dispatch(doLocalStreamEffect({ effectStream: handle.outputStream, only: "audio" }));

            dispatch(
                audioDenoiserApplied({
                    stop: handle.stop,
                    outputStream: handle.outputStream,
                    audioContext: handle.audioContext,
                    denoiserNode: handle.denoiserNode,
                }),
            );
        } catch (error) {
            dispatch(audioDenoiserError({ error }));
            return rejectWithValue(error);
        }
    },
);

const doAudioDenoiserTeardown = createAppAsyncThunk(
    "audioDenoiser/teardown",
    async (_, { getState, dispatch }) => {
        const raw = selectAudioDenoiserRaw(getState());
        if (!raw.stop) return;

        dispatch(audioDenoiserSwitching({ isSwitching: true }));
        try {
            if (raw.outputStream) {
                await dispatch(doLocalStreamEffect({ effectStream: undefined, only: "audio" }));
            }
            raw.stop();
        } finally {
            dispatch(audioDenoiserCleared());
        }
    },
);

export const doAudioDenoiserEnable = createAppAsyncThunk(
    "audioDenoiser/enable",
    async (_, { dispatch }) => {
        dispatch(audioDenoiserWantedSet({ wanted: true }));
        await dispatch(doAudioDenoiserApply());
    },
);

export const doAudioDenoiserDisable = createAppAsyncThunk<void, { keepWanted?: boolean } | undefined>(
    "audioDenoiser/disable",
    async (arg, { dispatch }) => {
        if (!arg?.keepWanted) {
            dispatch(audioDenoiserWantedSet({ wanted: false }));
        }
        await dispatch(doAudioDenoiserTeardown());
    },
);

// Pause the denoiser while the local stream is switching (mic/cam device
// change). Keep `wanted` so we reapply once the switch completes.
startAppListening({
    actionCreator: doSwitchLocalStream.pending,
    effect: async (_, { getState, dispatch }) => {
        if (selectAudioDenoiserEnabled(getState())) {
            await dispatch(doAudioDenoiserDisable({ keepWanted: true }));
        }
    },
});

// After a stream switch, reapply the denoiser onto the new stream if the
// user still wants it on.
startAppListening({
    actionCreator: doSwitchLocalStream.fulfilled,
    effect: async (_, { getState, dispatch }) => {
        const state = getState();
        if (selectAudioDenoiserWanted(state) && !selectAudioDenoiserEnabled(state)) {
            await dispatch(doAudioDenoiserApply());
        }
    },
});

startAppListening({
    actionCreator: doAppStop,
    effect: (_, { dispatch, getState }) => {
        if (selectAudioDenoiserRaw(getState()).stop) {
            dispatch(doAudioDenoiserDisable());
        }
    },
});
