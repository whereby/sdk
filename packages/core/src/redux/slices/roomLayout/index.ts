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
    ({ id, targetId }: { id: string; targetId: string }) =>
        (dispatch, getState) => {
            const clientIds = selectAllClientViews(getState()).map((c) => c.id);
            const index = clientIds.indexOf(id);
            const targetIndex = clientIds.indexOf(targetId);

            if (index < 0 || targetIndex < 0 || index === targetIndex) {
                return;
            }

            [clientIds[index], clientIds[targetIndex]] = [clientIds[targetIndex], clientIds[index]];

            dispatch(setSortedClientIds(clientIds));
        },
);

export const doSetClientViewOrder = createAppThunk((ids: string[]) => (dispatch) => {
    dispatch(setSortedClientIds(ids));
});
