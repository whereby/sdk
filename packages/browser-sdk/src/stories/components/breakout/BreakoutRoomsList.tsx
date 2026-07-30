import React from "react";
import BreakoutGroup from "./BreakoutGroup";
import { BreakoutActions, BreakoutState } from "./types";

export default function BreakoutRoomsList({
    breakout,
    joinBreakoutGroup,
    joinBreakoutMainRoom,
}: {
    breakout: BreakoutState;
    joinBreakoutGroup: BreakoutActions["joinBreakoutGroup"];
    joinBreakoutMainRoom: BreakoutActions["joinBreakoutMainRoom"];
}) {
    if (!breakout.isActive) {
        return null;
    }

    const currentGroupId = breakout.currentGroup?.id ?? "";
    const mainRoom = breakout.groupedParticipants.find((g) => g.group?.id === "");
    const groups = breakout.groupedParticipants.filter((g) => g.group && g.group.id !== "");

    return (
        <div className="breakoutRooms">
            <div className="breakoutCurrentGroup">
                You are in: <strong>{breakout.currentGroup?.name || "Main room"}</strong>
            </div>

            <h2>Breakout groups</h2>
            <div className="breakoutGroups">
                {groups.map((group) => (
                    <BreakoutGroup
                        key={group.group?.id}
                        id={group.group?.id || ""}
                        name={group.group?.name || "Group"}
                        clients={group.clients}
                        isCurrent={currentGroupId === group.group?.id}
                        onJoin={joinBreakoutGroup}
                    />
                ))}
            </div>

            <div className="breakoutMainRoom">
                <div className="breakoutGroupHeader">
                    <h2>Main room</h2>
                    <span className="breakoutGroupCount">{mainRoom?.clients.length ?? 0}</span>
                </div>
                <ul className="breakoutGroupParticipants">
                    {mainRoom?.clients.map((p) => (
                        <li key={p.id} className="breakoutGroupParticipant">
                            {p.displayName || "Guest"}
                        </li>
                    ))}
                </ul>
                <button onClick={() => joinBreakoutMainRoom()} disabled={currentGroupId === ""}>
                    {currentGroupId === "" ? "You're here" : "Join main room"}
                </button>
            </div>
        </div>
    );
}
