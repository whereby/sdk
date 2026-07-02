import React from "react";
import {
    BreakoutActions,
    BreakoutGroups,
    BreakoutState,
    LocalParticipant,
    RemoteParticipant,
    SpotlightedParticipant,
} from "./types";

export default function BreakoutHostControls({
    breakout,
    breakoutGroups,
    localParticipant,
    remoteParticipants,
    spotlightedParticipants,
    actions,
    addBreakoutGroup,
    removeBreakoutGroup,
    renameBreakoutGroup,
}: {
    breakout: BreakoutState;
    breakoutGroups: BreakoutGroups;
    localParticipant?: LocalParticipant;
    remoteParticipants: RemoteParticipant[];
    spotlightedParticipants: SpotlightedParticipant[];
    actions: BreakoutActions;
    addBreakoutGroup: () => void;
    removeBreakoutGroup: (id: string) => void;
    renameBreakoutGroup: (id: string, name: string) => void;
}) {
    const {
        updateBreakoutSession,
        assignBreakoutParticipants,
        assignAllBreakoutParticipants,
        unassignAllBreakoutParticipants,
        shuffleBreakoutParticipants,
        startBreakoutSession,
        stopBreakoutSession,
        extendBreakoutTimer,
        stopBreakoutTimer,
        broadcastToGroups,
        stopBroadcastToGroups,
    } = actions;

    const isHost = localParticipant?.roleName === "host";
    const notHostClass = isHost ? "" : "hostControlActionDisallowed";

    return (
        <div className="breakoutHostControls">
            <div>
                Your role: <strong>{localParticipant?.roleName ?? "unknown"}</strong>
                {!isHost ? " — breakout host actions require the host role (join with a host room key)" : ""}
            </div>
            {!breakout.isActive ? (
                <>
                    <div className="breakoutGroupsEditor">
                        <h4>Groups</h4>
                        {Object.entries(breakoutGroups).map(([id, name]) => (
                            <div key={id}>
                                <input value={name} onChange={(e) => renameBreakoutGroup(id, e.target.value)} />
                                <button
                                    onClick={() => removeBreakoutGroup(id)}
                                    disabled={Object.keys(breakoutGroups).length <= 1}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button onClick={addBreakoutGroup}>Add group</button>
                    </div>

                    <label>
                        <input
                            type="checkbox"
                            checked={breakout.enforceAssignment}
                            onChange={(e) => updateBreakoutSession({ enforceAssignment: e.target.checked })}
                        />
                        Enforce assignment (lock participants to their assigned group)
                    </label>

                    <div className="breakoutSettings">
                        <h4>Settings</h4>
                        <label>
                            <input
                                type="checkbox"
                                checked={breakout.autoMoveToGroup}
                                onChange={(e) => updateBreakoutSession({ autoMoveToGroup: e.target.checked })}
                            />
                            Auto-move assigned participants into their group
                        </label>{" "}
                        {breakout.autoMoveToGroup ? (
                            <label>
                                grace (s):{" "}
                                <input
                                    type="number"
                                    value={breakout.moveToGroupGracePeriod ?? 0}
                                    onChange={(e) =>
                                        updateBreakoutSession({ moveToGroupGracePeriod: Number(e.target.value) })
                                    }
                                />
                            </label>
                        ) : null}
                        <label>
                            <input
                                type="checkbox"
                                checked={breakout.autoMoveToMain}
                                onChange={(e) => updateBreakoutSession({ autoMoveToMain: e.target.checked })}
                            />
                            Auto-return to main room when the session ends
                        </label>{" "}
                        {breakout.autoMoveToMain ? (
                            <label>
                                grace (s):{" "}
                                <input
                                    type="number"
                                    value={breakout.moveToMainGracePeriod ?? 0}
                                    onChange={(e) =>
                                        updateBreakoutSession({ moveToMainGracePeriod: Number(e.target.value) })
                                    }
                                />
                            </label>
                        ) : null}
                        <label>
                            <input
                                type="checkbox"
                                checked={breakout.breakoutTimerSetting}
                                onChange={(e) => updateBreakoutSession({ breakoutTimerSetting: e.target.checked })}
                            />
                            Set a timer to end the session (duration is configurable once started)
                        </label>
                    </div>

                    <div>
                        <h4>Assign participants</h4>
                        <button onClick={() => assignAllBreakoutParticipants()}>Assign all</button>
                        <button onClick={() => shuffleBreakoutParticipants()}>Shuffle</button>
                        <button onClick={() => unassignAllBreakoutParticipants()}>Unassign all</button>
                        {localParticipant ? (
                            <div key={localParticipant.id}>
                                {localParticipant.displayName || "Guest"} (you){" "}
                                <select
                                    value={localParticipant.breakoutGroupAssigned || ""}
                                    onChange={(e) =>
                                        assignBreakoutParticipants({ [localParticipant.id]: e.target.value })
                                    }
                                >
                                    <option value="">Unassigned</option>
                                    {Object.entries(breakoutGroups).map(([id, name]) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        {remoteParticipants.map((p) => (
                            <div key={p.id}>
                                {p.displayName || "Guest"}{" "}
                                <select
                                    value={p.breakoutGroupAssigned || ""}
                                    onChange={(e) => assignBreakoutParticipants({ [p.id]: e.target.value })}
                                >
                                    <option value="">Unassigned</option>
                                    {Object.entries(breakoutGroups).map(([id, name]) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <button onClick={() => startBreakoutSession({ groups: breakoutGroups })} className={notHostClass}>
                        Start breakout session
                    </button>
                </>
            ) : null}

            {breakout.isActive ? (
                <div className="breakoutTimerControls">
                    {breakout.breakoutTimerSetting ? (
                        <div>
                            <label>
                                Timer duration (s):{" "}
                                <input
                                    type="number"
                                    value={breakout.breakoutTimerDuration}
                                    onChange={(e) =>
                                        updateBreakoutSession({ breakoutTimerDuration: Number(e.target.value) })
                                    }
                                />
                            </label>{" "}
                            {breakout.endTime ? (
                                <span>Ends at {new Date(breakout.endTime).toLocaleTimeString()}</span>
                            ) : null}
                            <button onClick={() => extendBreakoutTimer(60)}>Extend +1 min</button>
                            <button onClick={() => stopBreakoutTimer()}>Stop timer</button>
                        </div>
                    ) : null}
                    <button onClick={() => stopBreakoutSession()}>Stop breakout session</button>
                </div>
            ) : null}

            {breakout.isActive ? (
                <div className="breakoutBroadcast">
                    <h4>Broadcast to all groups</h4>
                    {breakout.broadcastingParticipants.length ? (
                        <div>
                            Currently broadcasting:{" "}
                            {breakout.broadcastingParticipants.map((c) => c.displayName || "Guest").join(", ")}
                        </div>
                    ) : null}
                    {[localParticipant, ...remoteParticipants]
                        .filter((p) => p && !p.breakoutGroup)
                        .map((p) => {
                            if (!p) return null;
                            const isBroadcasting = spotlightedParticipants.some((s) => s.id === p.id);
                            return (
                                <div key={p.id}>
                                    {p.displayName || "Guest"}{" "}
                                    <button
                                        onClick={() =>
                                            isBroadcasting ? stopBroadcastToGroups(p.id) : broadcastToGroups(p.id)
                                        }
                                    >
                                        {isBroadcasting ? "Stop broadcast" : "Broadcast"}
                                    </button>
                                </div>
                            );
                        })}
                </div>
            ) : null}
        </div>
    );
}
