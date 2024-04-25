import { type CellView } from "./types";

export function makeVideoCellView({
    aspectRatio,
    avatarSize,
    cellPaddings,
    client = undefined,
    isDraggable = true,
    isPlaceholder = false,
    isSubgrid = false,
}: Partial<CellView>): CellView {
    return {
        aspectRatio: aspectRatio || 16 / 9,
        avatarSize,
        cellPaddings,
        client,
        clientId: client?.id || "",
        isDraggable,
        isPlaceholder,
        isSubgrid,
        type: "video",
    };
}
