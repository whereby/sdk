import * as React from "react";

import { CallQualityScores, ClientView } from "@whereby.com/core";
import { WherebyContext } from "../../lib/react/Provider";
import { GridVideoView, useGridCell } from "../../lib/react/Grid";
import { DefaultParticipantMenu } from "../../lib/react/Grid/DefaultParticipantMenu";

const COLORS = {
    warning: "#f5c400",
    critical: "#e00000",
};

const LABELS = {
    warning: "Poor connection (warning)",
    critical: "Poor connection (critical)",
};

type Placement = "bottom" | "bottom-right";

const PLACEMENT_STYLES: Record<Placement, React.CSSProperties> = {
    bottom: { left: "50%", bottom: 8, transform: "translateX(-50%)" },
    "bottom-right": { right: 8, bottom: 8 },
};

/**
 * Subscribes to the call quality report on the room connection directly, rather than reading it from
 * useRoomConnection state: the grid memoises its cells, so a value captured by a render prop would go stale.
 */
function useCallQualityReport(): CallQualityScores {
    const client = React.useContext(WherebyContext);
    const roomConnection = React.useMemo(() => client?.getRoomConnection(), [client]);
    const [report, setReport] = React.useState<CallQualityScores>(
        () => roomConnection?.getState().callQualityReport ?? {},
    );

    React.useEffect(() => {
        if (!roomConnection) return;

        setReport(roomConnection.getState().callQualityReport);
        return roomConnection.subscribeToCallQualityReport(setReport);
    }, [roomConnection]);

    return report;
}

/**
 * A small dot showing a participant's call quality: yellow when it is "warning", red when it is
 * "critical", and nothing when it is "ok". It is absolutely positioned, so place it inside the
 * participant's (positioned) view.
 */
export function CallQualityIndicator({
    clientId,
    placement = "bottom-right",
}: {
    clientId?: string;
    placement?: Placement;
}) {
    const report = useCallQualityReport();
    const quality = clientId ? report[clientId]?.total : undefined;

    if (quality !== "warning" && quality !== "critical") {
        return null;
    }

    return (
        <div
            role="img"
            aria-label={LABELS[quality]}
            title={LABELS[quality]}
            style={{
                position: "absolute",
                ...PLACEMENT_STYLES[placement],
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "1px solid white",
                backgroundColor: COLORS[quality],
            }}
        />
    );
}

/**
 * The call quality indicator for a VideoGrid cell, in the cell's bottom right.
 */
export function GridCallQualityIndicator() {
    const { participant } = useGridCell();

    return <CallQualityIndicator clientId={participant?.clientId} />;
}

/**
 * Render props for VideoGrid that keep its default cell content and add the call quality indicator.
 */
export function withCallQualityIndicator({ enableParticipantMenu }: { enableParticipantMenu?: boolean } = {}) {
    const render = ({ participant }: { participant: ClientView }) => (
        <>
            <GridVideoView />
            {enableParticipantMenu ? <DefaultParticipantMenu participant={participant} /> : null}
            <GridCallQualityIndicator />
        </>
    );

    return {
        renderParticipant: render,
        renderSubgridParticipant: render,
        renderFloatingParticipant: render,
    };
}
