import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { createAppAsyncThunk } from "../thunk";
import { RootState } from "../store";
import { doLocalStreamEffect, selectLocalMediaIsSwitchingStream, selectLocalMediaStream } from "./localMedia";
import { Setup, Params } from "@whereby.com/camera-effects";

type TryUpdateFn = (presetId: string, setup: Setup, params: Params) => Promise<boolean>;
type StopFn = () => void;

export interface CameraEffectsState {
    currentEffectId?: string | null;
    setup?: Setup;
    params?: Params;
    isSwitching: boolean;
    error?: unknown;
    raw: {
        stop?: StopFn;
        tryUpdate?: TryUpdateFn;
        effectStream?: MediaStream;
    };
}

const initialState: CameraEffectsState = {
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
                raw?: { stop?: StopFn; tryUpdate?: TryUpdateFn; effectStream?: MediaStream };
            }>,
        ) {
            const { effectId, setup, params, raw } = action.payload;
            state.currentEffectId = effectId;
            state.setup = setup;
            state.params = params;
            if (raw) state.raw = raw;
            state.error = undefined;
            state.isSwitching = false;
        },
        cameraEffectsError(state, action: PayloadAction<{ error: unknown }>) {
            state.error = action.payload.error;
            state.isSwitching = false;
        },
    },
});

export const { cameraEffectsSwitching, cameraEffectsCleared, cameraEffectsUpdated, cameraEffectsError } =
    cameraEffectsSlice.actions;

export const selectCameraEffectsRaw = (state: RootState) => state.cameraEffects.raw;
export const selectCameraEffectId = (state: RootState) => state.cameraEffects.currentEffectId;
export const selectIsCameraEffectSwitching = (state: RootState) => state.cameraEffects.isSwitching;

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
                // No local video, nothing to do
                dispatch(cameraEffectsCleared());
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
                    dispatch(cameraEffectsUpdated({ effectId, setup, params }));
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
                    "@whereby.com/camera-effects is not installed. Add it as a dependency to enable camera effects.",
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

            dispatch(cameraEffectsUpdated({ effectId, setup, params, raw: { stop, tryUpdate, effectStream } }));
        } catch (error) {
            dispatch(cameraEffectsError({ error }));
            return rejectWithValue(error);
        }
    },
);

export const doCameraEffectsClear = createAppAsyncThunk("cameraEffects/clear", async (_, { dispatch }) => {
    await dispatch(doCameraEffectsSwitchPreset({ effectId: null }));
});
