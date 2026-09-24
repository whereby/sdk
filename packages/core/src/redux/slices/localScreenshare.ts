import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { createAsyncRoomConnectedThunk, createRoomConnectedThunk } from "../thunk";
import { RootState } from "../store";
import { startAppListening } from "../listenerMiddleware";
import { localMediaStopped } from "./localMedia";
import { getDisplayMedia } from "@whereby.com/media";
import { signalEvents } from "./signalConnection/actions";

export interface LocalScreenshareState {
    status: "inactive" | "starting" | "active" | "error";
    stream?: MediaStream;
    error?: unknown;
    startedAt?: number;
}

export const localScreenshareSliceInitialState: LocalScreenshareState = {
    status: "inactive",
    stream: undefined,
    error: undefined,
    startedAt: undefined,
};

/**
 * Reducer
 */

export const localScreenshareSlice = createSlice({
    name: "localScreenshare",
    initialState: localScreenshareSliceInitialState,
    reducers: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        stopScreenshare: (state, action: PayloadAction<{ stream: MediaStream }>) => {
            return {
                ...state,
                status: "inactive",
                stream: undefined,
                startedAt: undefined,
                error: undefined,
            };
        },
        stopScreenshareFailed: (state) => {
            return {
                ...state,
                status: "inactive",
                stream: undefined,
                startedAt: undefined,
                error: undefined,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(doStartScreenshare.pending, (state) => {
            return {
                ...state,
                status: "starting",
                error: undefined,
            };
        });
        builder.addCase(doStartScreenshare.fulfilled, (state, { payload: { stream } }) => {
            return {
                ...state,
                status: "active",
                stream,
                startedAt: new Date().getTime(),
                error: undefined,
            };
        });
        builder.addCase(doStartScreenshare.rejected, (state, { payload }) => {
            return {
                ...state,
                error: payload,
                status: "error",
                stream: undefined,
            };
        });
    },
});

/**
 * Action creators
 */

export const { stopScreenshare } = localScreenshareSlice.actions;

export const doStartScreenshare = createAsyncRoomConnectedThunk(
    "localScreenshare/doStartScreenshare",
    async (_, { dispatch, getState, rejectWithValue }) => {
        try {
            const state = getState();
            const screenshareStream = selectLocalScreenshareStream(state);

            if (screenshareStream) {
                return { stream: screenshareStream };
            }

            const stream = await getDisplayMedia({
                video: {
                    width: { max: window.screen.width },
                    height: { max: window.screen.height },
                },
                audio: {
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false,
                },
            });

            const onEnded = () => {
                dispatch(doStopScreenshare());
            };

            if ("oninactive" in stream) {
                // Chrome
                stream.addEventListener("inactive", onEnded);
            } else {
                // Firefox
                stream.getVideoTracks()[0]?.addEventListener("ended", onEnded);
            }

            return { stream };
        } catch (error) {
            return rejectWithValue(error);
        }
    },
);

export const doStopScreenshare = createRoomConnectedThunk(() => (dispatch, getState) => {
    const state = getState();
    const screenshareStream = selectLocalScreenshareStream(state);

    if (!screenshareStream) {
        dispatch(localScreenshareSlice.actions.stopScreenshareFailed());
        return;
    }

    screenshareStream.getTracks().forEach((track) => track.stop());
    dispatch(stopScreenshare({ stream: screenshareStream }));
});

/**
 * Selectors
 */

export const selectLocalScreenshareRaw = (state: RootState) => state.localScreenshare;
export const selectLocalScreenshareStatus = (state: RootState) => state.localScreenshare.status;
export const selectLocalScreenshareStream = (state: RootState) => state.localScreenshare.stream;
export const selectLocalScreenshareStartedAt = (state: RootState) => state.localScreenshare.startedAt;
export const selectLocalScreenshareError = (state: RootState) => state.localScreenshare.error;

/**
 * Reactors
 */

startAppListening({
    actionCreator: localMediaStopped,
    effect: (_, { getState }) => {
        const state = getState();
        const screenshareStream = selectLocalScreenshareStream(state);

        if (!screenshareStream) {
            return;
        }

        screenshareStream?.getTracks().forEach((track) => {
            track.stop();
        });
    },
});

startAppListening({
    actionCreator: signalEvents.screenshareEnableRequested,
    effect: ({ payload }, { dispatch }) => {
        const { enable } = payload;

        // Only handle disable screenshare case automatically.
        // Enable local screensharing case must be handled via `requestScreenshareEnable` notification
        if (!enable) {
            dispatch(doStopScreenshare());
        }
    },
});
