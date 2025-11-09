import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { LiveCaptionEvent } from "@whereby.com/media";
import { RootState } from "../store";
import { createRoomConnectedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { startAppListening } from "../listenerMiddleware";

/**
 * Reducer
 */

interface CaptionPart {
    resultId: string;
    text: string;
}

interface Caption {
    clientId: string;
    parts: CaptionPart[];
    timestamp: Date;
}

export interface LiveCaptionsState {
    isStarting: boolean;
    enabled: boolean;
    captionLog: Caption[];
    error: Error | null;
}

export const liveCaptionsSliceInitialState: LiveCaptionsState = {
    captionLog: [],
    isStarting: false,
    enabled: false,
    error: null,
};

const createCaptionPart = (captionPayload: LiveCaptionEvent): CaptionPart => ({
    resultId: captionPayload.resultId,
    text: captionPayload.text || "",
});

const createCaption = (captionPayload: LiveCaptionEvent) => {
    const hasSenderId = Boolean(captionPayload.senderId);

    return {
        shouldShowSenderDetails: hasSenderId,
        // for verbatim captions we don't have a senderId, so lets just separate by resultId so that a
        // gap in conversation will break up the resulting text into chunks
        // (and _theoretically_ will align with each speaker if there's enough of a gap between speakers)
        clientId: captionPayload.senderId ?? captionPayload.resultId,
        parts: [createCaptionPart(captionPayload)],
        timestamp: new Date(captionPayload.timestamp),
    };
};

const clearCaptionTimerIds: Record<string, NodeJS.Timeout> = {};

export const errorMiddleware = (store, next, action) => {
    const oldError = store.selectLiveCaptionsError();
    const remoteClients = store.selectRemoteClients();

    const result = next(action);

    const error = store.selectLiveCaptionsError();
    const isLiveCaptionsStarted = store.selectIsLiveCaptionsStarted();

    if (isLiveCaptionsStarted) {
        // determine that an error has occurred via heuristics
        const hasUnexpectedServiceError = determineRecordingServiceError({
            action,
            remoteClients,
            nonPersonRoleToWatch: "captioner",
        });

        if (hasUnexpectedServiceError) {
            const error = new Error("live_captions_stopped_unexpectedly");
            store.dispatch({ type: "LIVE_CAPTIONS_ERROR", error: error.message });
        }
    }

    if (Boolean(error) && error !== oldError) {
        store.doSetNotification("liveCaptionsError", {
            onDismiss: () => store.doClearLiveCaptionError(),
            message: error,
        });
    }

    return result;
};

export const LIVE_CAPTIONS_STALE_CAPTION_TIMEOUT = 5 * 1000;

export const liveCaptionsSlice = createSlice({
    name: "liveCaptions",
    initialState: liveCaptionsSliceInitialState,
    reducers: {
        doClearStaleCaption: (state, action: PayloadAction<{ clientId: string }>) => {
            const recentCaptions = state.captionLog
                .filter(({ clientId }) => clientId !== action.payload.clientId)
                .slice(-5);
            return {
                ...state,
                captionLog: recentCaptions,
            };
        },
    },
    extraReducers(builder) {
        builder.addCase(signalEvents.liveCaption, (state, action) => {
            const captionLog = [...state.captionLog];

            const nextCaption = createCaption(action.payload);

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

            const nextCaptionPart = createCaptionPart(action.payload);

            const isMatchingLastCaptionPart = lastCaptionPart?.resultId === nextCaptionPart.resultId;

            const parts: CaptionPart[] = isMatchingLastCaptionPart
                ? [...lastCaptionParts, nextCaptionPart] // replace lastCaptionPart with nextCaptionPart
                : lastCaptionPart
                    ? [lastCaptionPart, nextCaptionPart] // only keep max. two caption parts to avoid long monologues taking over the whole screen
                    : [nextCaptionPart];

            const nextState: LiveCaptionsState = {
                ...state,
                captionLog: [
                    ...captionLog.slice(0, matchingCaptionIndex),
                    ...(!isMatchingLastCaptionPart ? captionLog.slice(matchingCaptionIndex + 1) : []),
                    {
                        ...nextCaption,
                        parts,
                    },
                    ...(isMatchingLastCaptionPart ? captionLog.slice(matchingCaptionIndex + 1) : []),
                ],
            };
            return nextState;
        });
    },
});

/**
 * Reactors
 */

startAppListening({
    actionCreator: signalEvents.liveCaption,
    effect: ({ payload }, { dispatch }) => {
        const clientId = payload.senderId ?? payload.resultId;
        clearTimeout(clearCaptionTimerIds[clientId]);
        clearCaptionTimerIds[clientId] = setTimeout(
            () => dispatch(liveCaptionsSlice.actions.doClearStaleCaption({ clientId })),
            LIVE_CAPTIONS_STALE_CAPTION_TIMEOUT,
        );
    },
});

/**
 * Action creators
 */
export const doSendLiveCaption = createRoomConnectedThunk((payload: LiveCaptionEvent) => (_, getState) => {
    const state = getState();
    const socket = selectSignalConnectionRaw(state).socket;

    socket?.emit("live_caption", payload);
});

/**
 * Selectors
 */
export const selectChatRaw = (state: RootState) => state.chat;
export const selectChatMessages = (state: RootState) => state.chat.chatMessages;
