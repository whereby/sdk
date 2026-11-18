import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { createAppThunk } from "../../thunk";
import { selectAllClientViews } from "../room";

/**
 * Reducer
 */

export interface RoomLayoutState {
    sortedClientIds: string[];
}

export const roomLayoutSliceInitialState: RoomLayoutState = {
    sortedClientIds: [],
};

export const roomLayoutSlice = createSlice({
    name: "roomLayout",
    initialState: roomLayoutSliceInitialState,
    reducers: {
        setSortedClientIds(state, action: PayloadAction<string[]>) {
            return {
                ...state,
                sortedClientIds: Array.from(new Set(action.payload)),
            };
        },
    },
});

/**
 * Action creators
 */

export const { setSortedClientIds } = roomLayoutSlice.actions;

export const doReorderClientViews = createAppThunk(
    ({ id, targetId }: { id: string; targetId: string }) =>
        (dispatch, getState) => {
            const clientIds = selectSortedClientViews(getState()).map((c) => c.id);
            const index = clientIds.indexOf(id);
            const targetIndex = clientIds.indexOf(targetId);

            if (index < 0 || targetIndex < 0 || index === targetIndex) {
                return;
            }

            [clientIds[index], clientIds[targetIndex]] = [clientIds[targetIndex], clientIds[index]];

            dispatch(setSortedClientIds(clientIds));
        },
);

/**
 * Selectors
 */

export const selectRoomLayoutRaw = (state: RootState) => state.roomLayout;
export const selectSortedClientIds = (state: RootState) => state.roomLayout.sortedClientIds;

export const selectSortedClientViews = createSelector(
    selectAllClientViews,
    selectSortedClientIds,
    (clientViews, sortedClientIds) => sortClientViews({ sortedClientIds, clientViews }),
);

/**
 * State mapping utils
 */

export function sortClientViews<T extends { id: string }>({
    sortedClientIds,
    clientViews,
}: {
    sortedClientIds: string[];
    clientViews: T[];
}): T[] {
    if (!sortedClientIds.length) {
        return clientViews;
    }

    const rank = new Map(sortedClientIds.map((id, index) => [id, index]));
    const unranked = sortedClientIds.length;

    return clientViews
        .map((clientView, index) => ({ clientView, index, rank: rank.get(clientView.id) ?? unranked }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(({ clientView }) => clientView);
}
