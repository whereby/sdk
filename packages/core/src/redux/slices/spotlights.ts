import { createSelector, createSlice, isAnyOf } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { ClientView } from "../types";
import {
    AddSpotlightRequest,
    CAMERA_STREAM_ID,
    type RemoveSpotlightRequest,
    type Spotlight,
    type SwapSpotlightOrderRequest,
} from "@whereby.com/media";
import { selectSignalConnectionRaw, signalEvents } from "./signalConnection";
import { selectLocalParticipantRaw } from "./localParticipant/selectors";
import { createAppAuthorizedThunk } from "../thunk";
import { selectIsAuthorizedToSpotlight } from "./authorization";
import { selectAllClientViews } from "./room";
import { doStartScreenshare, stopScreenshare } from "./localScreenshare";
import { startAppListening } from "../listenerMiddleware";

/**
 * State mapping utils
 */

export function streamIdForClient({ isPresentation, stream }: Pick<ClientView, "isPresentation" | "stream">) {
    // outboundId and inboundId are the streamId's used by SFU V2
    return isPresentation ? (stream?.outboundId ?? stream?.inboundId ?? stream?.id) : CAMERA_STREAM_ID;
}

export function isClientSpotlighted({
    spotlights,
    isPresentation,
    clientId,
    stream,
}: {
    spotlights: Spotlight[];
    isPresentation?: boolean;
    clientId: string;
    stream: ClientView["stream"];
}) {
    return !!spotlights.find((s) => {
        const streamId = streamIdForClient({ isPresentation, stream });
        return s.clientId === clientId && s.streamId === streamId;
    });
}

function mergeSpotlight(spotlights: Spotlight[], spotlight: Spotlight) {
    const found = spotlights.find((s) => s.clientId === spotlight.clientId && s.streamId === spotlight.streamId);
    if (found) {
        return spotlights;
    }
    return spotlights.concat(spotlight);
}

const isSameSpotlight = (a: Spotlight, b: Spotlight) => a.clientId === b.clientId && a.streamId === b.streamId;

function swapSpotlights(spotlights: Spotlight[], source: Spotlight, target: Spotlight) {
    const index = spotlights.findIndex((s) => isSameSpotlight(s, source));
    const withIndex = spotlights.findIndex((s) => isSameSpotlight(s, target));
    if (index < 0 || withIndex < 0 || index === withIndex) {
        return spotlights;
    }

    const swapped = [...spotlights];
    [swapped[index], swapped[withIndex]] = [swapped[withIndex], swapped[index]];
    return swapped;
}

function mapSpotlightsToClientViews(spotlights: Spotlight[], clientViews: ClientView[]) {
    return spotlights.reduce((acc, s) => {
        const clientView = clientViews.find((c) => s.clientId === c.clientId && s.streamId === streamIdForClient(c));
        if (clientView && !acc.includes(clientView)) {
            acc.push(clientView);
        }
        return acc;
    }, [] as ClientView[]);
}

/**
 * Reducer
 */

export interface SpotlightsState {
    sorted: { clientId: string; streamId: string }[];
}

export const spotlightsSliceInitialState: SpotlightsState = {
    sorted: [],
};

export const spotlightsSlice = createSlice({
    name: "spotlights",
    initialState: spotlightsSliceInitialState,
    reducers: {
        addSpotlight(state, action: { payload: { clientId: string; streamId: string } }) {
            const { clientId, streamId } = action.payload;

            return {
                ...state,
                sorted: mergeSpotlight(state.sorted, { clientId, streamId }),
            };
        },
        removeSpotlight(state, action: { payload: { clientId: string; streamId: string } }) {
            const { clientId, streamId } = action.payload;

            return {
                ...state,
                sorted: state.sorted.filter((s) => !(s.clientId === clientId && s.streamId === streamId)),
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if ("error" in action.payload) {
                return state;
            }

            const { room } = action.payload || {};

            if (room) {
                return {
                    ...state,
                    sorted: room.spotlights ?? state.sorted,
                };
            }

            return state;
        });
        builder.addCase(signalEvents.spotlightAdded, (state, action) => {
            const { clientId, streamId } = action.payload;
            return {
                ...state,
                sorted: mergeSpotlight(state.sorted, { clientId, streamId }),
            };
        });
        builder.addCase(signalEvents.spotlightRemoved, (state, action) => {
            const { clientId, streamId } = action.payload;
            return {
                ...state,
                sorted: state.sorted.filter((s) => !(s.clientId === clientId && s.streamId === streamId)),
            };
        });
        builder.addCase(signalEvents.spotlightOrderSwapped, (state, action) => {
            if ("error" in action.payload) {
                return state;
            }

            const { source, target } = action.payload;
            const sorted = swapSpotlights(state.sorted, source, target);
            return sorted === state.sorted ? state : { ...state, sorted };
        });
        builder.addMatcher(isAnyOf(signalEvents.clientKicked, signalEvents.clientLeft), (state, action) => {
            const { clientId } = action.payload;
            return {
                ...state,
                sorted: state.sorted.filter((s) => s.clientId !== clientId),
            };
        });
    },
});

/**
 * Action creators
 */

export const { addSpotlight, removeSpotlight } = spotlightsSlice.actions;

export const doSpotlightParticipant = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToSpotlight(state),
    ({ id }: { id: string }) =>
        (_, getState) => {
            const state = getState();
            const clientView = selectAllClientViews(state).find((c) => c.clientId === id);

            if (!clientView) {
                return;
            }
            const { socket } = selectSignalConnectionRaw(state);
            const streamId = streamIdForClient(clientView);
            const payload: AddSpotlightRequest = { clientId: clientView.id, streamId: streamId ?? CAMERA_STREAM_ID };
            socket?.emit("add_spotlight", payload);
        },
);

export const doRemoveSpotlight = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToSpotlight(state),
    ({ id }: { id: string }) =>
        (_, getState) => {
            const state = getState();
            const clientView = selectAllClientViews(state).find((c) => c.clientId === id);

            if (!clientView) {
                return;
            }
            const { socket } = selectSignalConnectionRaw(state);
            const streamId = streamIdForClient(clientView);
            const payload: RemoveSpotlightRequest = { clientId: clientView.id, streamId: streamId ?? CAMERA_STREAM_ID };

            socket?.emit("remove_spotlight", payload);
        },
);

// The order changes when the server broadcasts spotlight_order_swapped
export const doSwapSpotlightOrder = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToSpotlight(state),
    ({ id, withId }: { id: string; withId: string }) =>
        (_, getState) => {
            const state = getState();
            const clientViews = selectAllClientViews(state);
            const spotlights = selectSpotlights(state);
            const toSpotlight = (clientViewId: string): Spotlight | null => {
                const clientView = clientViews.find((c) => c.id === clientViewId);
                if (!clientView) {
                    return null;
                }
                const spotlight = {
                    clientId: clientView.clientId,
                    streamId: streamIdForClient(clientView) ?? CAMERA_STREAM_ID,
                };
                return spotlights.some((s) => isSameSpotlight(s, spotlight)) ? spotlight : null;
            };

            const source = toSpotlight(id);
            const target = toSpotlight(withId);

            if (!source || !target || isSameSpotlight(source, target)) {
                return;
            }

            const { socket } = selectSignalConnectionRaw(state);
            const payload: SwapSpotlightOrderRequest = { source, target };
            socket?.emit("swap_spotlight_order", payload);
        },
);

/**
 * Selectors
 */

export const selectSpotlightsRaw = (state: RootState) => state.spotlights;
export const selectSpotlights = (state: RootState) => state.spotlights.sorted;
export const selectIsLocalParticipantSpotlighted = createSelector(
    selectLocalParticipantRaw,
    selectSpotlights,
    (localParticipant, spotlights) => {
        return isClientSpotlighted({ clientId: localParticipant.id, stream: localParticipant.stream, spotlights });
    },
);
export const selectSpotlightedClientViews = createSelector(
    selectAllClientViews,
    selectSpotlights,
    (clientViews, spotlights) => {
        return mapSpotlightsToClientViews(spotlights, clientViews);
    },
);

/**
 * Reactors
 */

startAppListening({
    actionCreator: doStartScreenshare.fulfilled,
    effect: ({ payload }, { getState, dispatch }) => {
        const { stream } = payload;
        const state = getState();

        const localParticipant = selectLocalParticipantRaw(state);

        if (!localParticipant) {
            return;
        }

        dispatch(addSpotlight({ clientId: localParticipant.id, streamId: stream.id }));
    },
});

startAppListening({
    actionCreator: stopScreenshare,
    effect: ({ payload }, { getState, dispatch }) => {
        const { stream } = payload;
        const state = getState();

        const localParticipant = selectLocalParticipantRaw(state);

        if (!localParticipant) {
            return;
        }

        dispatch(removeSpotlight({ clientId: localParticipant.id, streamId: stream.id }));
    },
});
