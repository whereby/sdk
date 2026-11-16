import { RootState } from "../../store";

/**
 * Selectors
 */

export const selectRoomLayoutRaw = (state: RootState) => state.roomLayout;
export const selectSortedClientIds = (state: RootState) => state.roomLayout.sortedClientIds;

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
