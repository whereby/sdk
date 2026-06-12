import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createRoomConnectedThunk } from "../thunk";
import LiveCaption, { type LiveCaptionPart } from "../../api/models/LiveCaption";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";

/**
 * Reducer
 */
export interface LiveCaptionsState {
    isCaptioning: boolean;
    error?: string;
    status?: "captioning" | "requested" | "error";
    startedAt?: number;
    captionLog: Array<LiveCaption>;
}

export const initialLiveCaptionsState: LiveCaptionsState = {
    isCaptioning: false,
    captionLog: [],
};

export const liveCaptionsSlice = createSlice({
    name: "liveCaptions",
    initialState: initialLiveCaptionsState,
    reducers: {
        captioningRequestStarted: (state) => {
            return {
                ...state,
                status: "requested",
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.liveCaptionsStopped, (state) => {
            return {
                ...state,
                isCaptioning: false,
                startedAt: undefined,
                status: undefined,
                error: undefined,
                captionLog: [],
            };
        });
        builder.addCase(signalEvents.liveCaptionsStarted, (state, action) => {
            const { payload } = action;

            if (payload.error) {
                return {
                    ...state,
                    isCaptioning: false,
                    startedAt: undefined,
                    status: "error",
                    error: payload.error,
                    captionLog: [],
                };
            }

            return {
                ...state,
                isCaptioning: true,
                startedAt: Date.now(),
                status: "captioning",
                error: undefined,
                captionLog: [],
            };
        });
        builder.addCase(signalEvents.liveCaption, (state, action) => {
            const { payload } = action;

            const captionLog = [...state.captionLog];

            const nextCaption = new LiveCaption(payload);

            const matchingCaptionIndex = captionLog.findIndex(({ clientId }) => clientId === nextCaption.clientId);

            if (matchingCaptionIndex < 0) {
                return {
                    ...state,
                    captionLog: [...captionLog, nextCaption],
                };
            }

            const matchingCaption = captionLog[matchingCaptionIndex];

            const lastCaptionParts = [...matchingCaption.parts];
            const lastCaptionPart = lastCaptionParts.pop();

            const nextCaptionPart: LiveCaptionPart = {
                resultId: payload.resultId,
                text: payload.text,
            };

            const isMatchingLastCaptionPart = lastCaptionPart?.resultId === nextCaptionPart.resultId;

            const parts = isMatchingLastCaptionPart
                ? ([...lastCaptionParts, nextCaptionPart] as Array<LiveCaptionPart>) // replace lastCaptionPart with nextCaptionPart
                : ([lastCaptionPart, nextCaptionPart] as Array<LiveCaptionPart>); // only keep max. two caption parts to avoid long monologues taking over the whole screen

            return {
                ...state,
                captionLog: [
                    ...captionLog.slice(0, matchingCaptionIndex),
                    ...(!isMatchingLastCaptionPart ? captionLog.slice(matchingCaptionIndex + 1) : []),
                    {
                        ...nextCaption,
                        parts: parts.filter((part) => Boolean(part)),
                    },
                    ...(isMatchingLastCaptionPart ? captionLog.slice(matchingCaptionIndex + 1) : []),
                ],
            };
        });
    },
});

/**
 * Action creators
 */
export const { captioningRequestStarted } = liveCaptionsSlice.actions;

export const doStartLiveCaptions = createRoomConnectedThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;
    const status = selectLiveCaptionsStatus(state);

    if (status && ["captioning", "requested"].includes(status)) {
        return;
    }

    socket?.emit("live_captions_enabled");

    dispatch(captioningRequestStarted());
});

export const doStopLiveCaptions = createRoomConnectedThunk(() => (dispatch, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;

    socket?.emit("live_captions_disabled");
});

/**
 * Selectors
 */
export const selectLiveCaptionsRaw = (state: RootState) => state.liveCaptions;
export const selectLiveCaptionsStatus = (state: RootState) => state.liveCaptions.status;
export const selectLiveCaptionsStartedAt = (state: RootState) => state.liveCaptions.startedAt;
export const selectLiveCaptionsError = (state: RootState) => state.liveCaptions.error;
export const selectLiveCaptionsLog = (state: RootState) => state.liveCaptions.captionLog;
export const selectIsLiveCaptions = (state: RootState) => state.liveCaptions.isCaptioning;
