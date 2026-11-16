import { createSlice, PayloadAction } from "@reduxjs/toolkit";
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
    ({ id, withId }: { id: string; withId: string }) =>
        (dispatch, getState) => {
            const clientIds = selectAllClientViews(getState()).map((c) => c.id);
            const index = clientIds.indexOf(id);
            const withIndex = clientIds.indexOf(withId);

            if (index < 0 || withIndex < 0 || index === withIndex) {
                return;
            }

            [clientIds[index], clientIds[withIndex]] = [clientIds[withIndex], clientIds[index]];

            dispatch(setSortedClientIds(clientIds));
        },
);

export const doSetClientViewOrder = createAppThunk((ids: string[]) => (dispatch) => {
    dispatch(setSortedClientIds(ids));
});
