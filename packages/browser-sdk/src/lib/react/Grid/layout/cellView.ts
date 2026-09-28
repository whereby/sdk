import { RoomIntegrationSessionView } from "@whereby.com/core";

import { type CellView, type IntegrationCellView, type VideoCellView } from "./types";

export function makeVideoCellView({
    aspectRatio,
    avatarSize,
    cellPaddings,
    client = undefined,
    isDraggable = true,
    isPlaceholder = false,
    isSubgrid = false,
}: Partial<VideoCellView>): CellView {
    return {
        aspectRatio: aspectRatio || 16 / 9,
        avatarSize,
        cellPaddings,
        client,
        cellId: client?.id || "",
        clientId: client?.id || "",
        isDraggable,
        isPlaceholder,
        isSubgrid,
        type: "video",
    };
}

function integrationAspectRatio(session: RoomIntegrationSessionView): number | undefined {
    const reported = Number(session.props?.aspectratio);
    return isFinite(reported) && reported > 0 ? reported : undefined;
}

export function roomIntegrationCellId(session: RoomIntegrationSessionView): string {
    return `room-integration:${session.roomIntegrationSessionId}`;
}

export function makeIntegrationCellView({
    session,
    isDraggable = false,
    isSubgrid = false,
}: {
    session: RoomIntegrationSessionView;
    isDraggable?: boolean;
    isSubgrid?: boolean;
}): IntegrationCellView {
    const cellId = roomIntegrationCellId(session);

    return {
        aspectRatio: integrationAspectRatio(session) || 16 / 9,
        cellId,
        clientId: cellId,
        isDraggable,
        isSubgrid,
        session,
        type: "integration",
    };
}
