import React from "react";
import BreakoutHostControls from "./BreakoutHostControls";
import BreakoutRoomsList from "./BreakoutRoomsList";
import { useBreakoutGroups } from "./useBreakoutGroups";
import { useBreakoutNotifications } from "./useBreakoutNotifications";
import { BreakoutActions, BreakoutState, LocalParticipant, RemoteParticipant, SpotlightedParticipant } from "./types";

export default function BreakoutPanel({
    breakout,
    connectionStatus,
    localParticipant,
    remoteParticipants,
    spotlightedParticipants,
    actions,
    showHostControls,
}: {
    breakout: BreakoutState;
    connectionStatus: string;
    localParticipant?: LocalParticipant;
    remoteParticipants: RemoteParticipant[];
    spotlightedParticipants: SpotlightedParticipant[];
    actions: BreakoutActions;
    showHostControls?: boolean;
}) {
    const { breakoutGroups, addBreakoutGroup, removeBreakoutGroup, renameBreakoutGroup } = useBreakoutGroups({
        breakout,
        isHost: localParticipant?.roleName === "host",
        connectionStatus,
        updateBreakoutSession: actions.updateBreakoutSession,
    });

    useBreakoutNotifications({
        breakout,
        localParticipant,
        joinBreakoutGroup: actions.joinBreakoutGroup,
        joinBreakoutMainRoom: actions.joinBreakoutMainRoom,
    });

    return (
        <div className="breakout">
            <h3>Breakout is {breakout.isActive ? "active" : "inactive"}</h3>

            {showHostControls ? (
                <BreakoutHostControls
                    breakout={breakout}
                    breakoutGroups={breakoutGroups}
                    localParticipant={localParticipant}
                    remoteParticipants={remoteParticipants}
                    spotlightedParticipants={spotlightedParticipants}
                    actions={actions}
                    addBreakoutGroup={addBreakoutGroup}
                    removeBreakoutGroup={removeBreakoutGroup}
                    renameBreakoutGroup={renameBreakoutGroup}
                />
            ) : null}

            <BreakoutRoomsList
                breakout={breakout}
                joinBreakoutGroup={actions.joinBreakoutGroup}
                joinBreakoutMainRoom={actions.joinBreakoutMainRoom}
            />
        </div>
    );
}
