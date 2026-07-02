import React from "react";
import { ClientView } from "@whereby.com/core";

export default function BreakoutGroup({
    id,
    name,
    clients,
    isCurrent,
    onJoin,
}: {
    id: string;
    name: string;
    clients: ClientView[];
    isCurrent: boolean;
    onJoin: (groupId: string) => void;
}) {
    return (
        <div className={`breakoutGroup${isCurrent ? " breakoutGroup--current" : ""}`}>
            <div className="breakoutGroupHeader">
                <h3>{name}</h3>
                <span className="breakoutGroupCount">{clients.length}</span>
            </div>
            <ul className="breakoutGroupParticipants">
                {clients.length ? (
                    clients.map((p) => (
                        <li key={p.id} className="breakoutGroupParticipant">
                            {p.displayName || "Guest"}
                        </li>
                    ))
                ) : (
                    <li className="breakoutGroupParticipant breakoutGroupParticipant--empty">Empty</li>
                )}
            </ul>
            <button onClick={() => onJoin(id)} disabled={isCurrent}>
                {isCurrent ? "You're here" : "Join"}
            </button>
        </div>
    );
}
