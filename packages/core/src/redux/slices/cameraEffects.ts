import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { createAppAsyncThunk } from "../thunk";
import { RootState } from "../store";
import { startAppListening } from "../listenerMiddleware";
import { doAppStop } from "./app";
import {
    doLocalStreamEffect,
    doToggleCamera,
    selectIsCameraEnabled,
    selectLocalMediaIsSwitchingStream,
    selectLocalMediaStream,
} from "./localMedia";
import { Setup, Params } from "@whereby.com/camera-effects";

type TryUpdateFn = (presetId: string, setup: Setup, params: Params) => Promise<boolean>;
type StopFn = () => void;

export interface CameraEffectsState {
    currentEffectId?: string | null;
    setup?: Setup;
    params?: Params;
    backgroundUrl?: string;
    allowSafari?: boolean;
    isPaused: boolean;
    isSwitching: boolean;
    error?: unknown;
    raw: {
        stop?: StopFn;
        tryUpdate?: TryUpdateFn;
        effectStream?: MediaStream;
    };
}

const initialState: CameraEffectsState = {
    isPaused: false,
    isSwitching: false,
    raw: {},
};

export const cameraEffectsSlice = createSlice({
    name: "cameraEffects",
    initialState,
    reducers: {
        cameraEffectsSwitching(state, action: PayloadAction<{ isSwitching: boolean }>) {
            state.isSwitching = action.payload.isSwitching;
        },
        cameraEffectsCleared(state) {
            state.currentEffectId = null;
            state.setup = undefined;
            state.params = undefined;
            state.backgroundUrl = undefined;
            state.allowSafari = undefined;
            state.isPaused = false;
            state.raw = {};
            state.error = undefined;
            state.isSwitching = false;
        },
        cameraEffectsUpdated(
            state,
            action: PayloadAction<{
                effectId: string;
                setup?: Setup;
                params?: Params;
                backgroundUrl?: string;
                allowSafari?: boolean;
                raw?: { stop?: StopFn; tryUpdate?: TryUpdateFn; effectStream?: MediaStream };
            }>,
        ) {
            const { effectId, setup, params, backgroundUrl, allowSafari, raw } = action.payload;
            state.currentEffectId = effectId;
            state.setup = setup;
            state.params = params;
            state.backgroundUrl = backgroundUrl;
            state.allowSafari = allowSafari;
            state.isPaused = false;
            if (raw) state.raw = raw;
            state.error = undefined;
            state.isSwitching = false;
        },
        cameraEffectsPaused(
            state,
            action: PayloadAction<
                | { effectId?: string; setup?: Setup; params?: Params; backgroundUrl?: string; allowSafari?: boolean }
                | undefined
            >,
        ) {
            const payload = action.payload;
            if (payload?.effectId !== undefined) {
                state.currentEffectId = payload.effectId;
                state.setup = payload.setup;
                state.params = payload.params;
                state.backgroundUrl = payload.backgroundUrl;
                state.allowSafari = payload.allowSafari;
            }
            state.isPaused = true;
            state.raw = {};
            state.error = undefined;
            state.isSwitching = false;
        },
        cameraEffectsError(state, action: PayloadAction<{ error: unknown }>) {
            state.error = action.payload.error;
            state.isSwitching = false;
        },
    },
});

export const {
    cameraEffectsSwitching,
    cameraEffectsCleared,
    cameraEffectsUpdated,
    cameraEffectsPaused,
    cameraEffectsError,
} = cameraEffectsSlice.actions;

export const selectCameraEffectsRaw = (state: RootState) => state.cameraEffects.raw;
export const selectCameraEffectId = (state: RootState) => state.cameraEffects.currentEffectId;
export const selectIsCameraEffectSwitching = (state: RootState) => state.cameraEffects.isSwitching;
export const selectIsCameraEffectPaused = (state: RootState) => state.cameraEffects.isPaused;

export const doCameraEffectsSwitchPreset = createAppAsyncThunk(
    "cameraEffects/switchPreset",
    async (
        {
            effectId,
            setup,
            params,
            allowSafari,
            backgroundUrl,
        }: { effectId: string | null; setup?: Setup; params?: Params; allowSafari?: boolean; backgroundUrl?: string },
        { getState, dispatch, rejectWithValue },
    ) => {
        const state = getState();

        if (selectLocalMediaIsSwitchingStream(state)) {
            return;
        }

        const mergedParams = { ...params, ...(backgroundUrl ? { backgroundUrl } : {}) };

        dispatch(cameraEffectsSwitching({ isSwitching: true }));

        try {
            const raw = selectCameraEffectsRaw(state);
            const localStream = selectLocalMediaStream(state);

            if (!localStream?.getVideoTracks()?.[0]) {
                if (!effectId) {
                    // No local video and no effect wanted, nothing to do
                    dispatch(cameraEffectsCleared());
                } else {
                    // The camera is off, so there is nothing to apply the effect to yet.
                    // Remember it as paused and apply it automatically once the camera is on.
                    dispatch(cameraEffectsPaused({ effectId, setup, params, backgroundUrl, allowSafari }));
                }
                return;
            }

            // Disable/clear
            if (!effectId) {
                if (raw.effectStream) {
                    await dispatch(doLocalStreamEffect({ effectStream: undefined, only: "video" }));
                }
                raw.stop?.();
                dispatch(cameraEffectsCleared());
                return;
            }

            if (raw.tryUpdate) {
                const ok = await raw.tryUpdate(effectId, { ...(setup || {}) }, mergedParams);
                if (ok) {
                    dispatch(cameraEffectsUpdated({ effectId, setup, params, backgroundUrl, allowSafari }));
                    return;
                }
            }

            if (raw.effectStream) {
                await dispatch(doLocalStreamEffect({ effectStream: undefined, only: "video" }));
                raw.stop?.();
            }

            let mod: typeof import("@whereby.com/camera-effects");
            try {
                mod = await import("@whereby.com/camera-effects");
            } catch {
                throw new Error(
                    "Failed to load @whereby.com/camera-effects. Check your network connection and that the package is resolvable.",
                );
            }

            const { createEffectStream, getUsablePresets } = mod;
            const usable = getUsablePresets({ filter: () => true, options: { allowSafari } });
            if (!usable.includes(effectId) && effectId !== "image-custom") {
                throw new Error(`Unknown or unsupported effect preset: ${effectId}`);
            }

            const {
                stream: effectStream,
                stop,
                tryUpdate,
            } = await createEffectStream(localStream, effectId, setup, mergedParams);

            // Replace local media video track
            await dispatch(doLocalStreamEffect({ effectStream, only: "video" }));

            dispatch(
                cameraEffectsUpdated({
                    effectId,
                    setup,
                    params,
                    backgroundUrl,
                    allowSafari,
                    raw: { stop, tryUpdate, effectStream },
                }),
            );
        } catch (error) {
            dispatch(cameraEffectsError({ error }));
            return rejectWithValue(error);
        }
    },
);

export const doCameraEffectsClear = createAppAsyncThunk("cameraEffects/clear", async (_, { dispatch }) => {
    await dispatch(doCameraEffectsSwitchPreset({ effectId: null }));
});

export const doCameraEffectsPause = createAppAsyncThunk("cameraEffects/pause", async (_, { dispatch, getState }) => {
    const raw = selectCameraEffectsRaw(getState());

    raw.stop?.();
    await dispatch(doLocalStreamEffect({ effectStream: undefined, only: "video", stopBeforeTrack: true }));

    dispatch(cameraEffectsPaused());
});

export const doCameraEffectsResume = createAppAsyncThunk("cameraEffects/resume", async (_, { dispatch, getState }) => {
    const state = getState();
    const effectId = selectCameraEffectId(state);
    if (!effectId) {
        return;
    }

    const { setup, params, backgroundUrl, allowSafari } = state.cameraEffects;
    await dispatch(doCameraEffectsSwitchPreset({ effectId, setup, params, backgroundUrl, allowSafari }));
});

startAppListening({
    actionCreator: doAppStop,
    effect: (_, { dispatch, getState }) => {
        if (selectCameraEffectsRaw(getState()).stop) {
            dispatch(doCameraEffectsClear());
        }
    },
});

startAppListening({
    actionCreator: doToggleCamera.fulfilled,
    effect: (_, { dispatch, getState }) => {
        const state = getState();
        const cameraEnabled = selectIsCameraEnabled(state);
        const effectId = selectCameraEffectId(state);
        const isPaused = selectIsCameraEffectPaused(state);

        if (!cameraEnabled) {
            const raw = selectCameraEffectsRaw(state);
            if (effectId && raw.stop && !isPaused) {
                dispatch(doCameraEffectsPause());
            }
        } else if (effectId && isPaused) {
            const stream = selectLocalMediaStream(state);
            if (stream?.getVideoTracks()?.[0]) {
                dispatch(doCameraEffectsResume());
            }
        }
    },
});
