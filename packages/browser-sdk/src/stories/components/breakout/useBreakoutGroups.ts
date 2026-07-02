import { useEffect, useState } from "react";
import { BreakoutActions, BreakoutGroups, BreakoutState } from "./types";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export function useBreakoutGroups({
    breakout,
    isHost,
    connectionStatus,
    updateBreakoutSession,
}: {
    breakout: BreakoutState;
    isHost: boolean;
    connectionStatus: string;
    updateBreakoutSession: BreakoutActions["updateBreakoutSession"];
}) {
    const [breakoutGroups, setBreakoutGroups] = useState<BreakoutGroups>({
        a: "Group A",
        b: "Group B",
    });

    useEffect(() => {
        if (connectionStatus !== "connected" || !isHost) return;
        if (!breakout.groups) {
            updateBreakoutSession({ groups: breakoutGroups });
        } else if (JSON.stringify(breakout.groups) !== JSON.stringify(breakoutGroups)) {
            setBreakoutGroups(breakout.groups);
        }
    }, [connectionStatus, isHost, breakout.groups]);

    function applyGroups(newGroups: BreakoutGroups) {
        setBreakoutGroups(newGroups);
        updateBreakoutSession({ groups: newGroups });
    }

    function addBreakoutGroup() {
        const usedIds = Object.keys(breakoutGroups);
        const nextId = ALPHABET.split("").find((c) => !usedIds.includes(c));
        if (!nextId) return;
        applyGroups({ ...breakoutGroups, [nextId]: `Group ${nextId.toUpperCase()}` });
    }

    function removeBreakoutGroup(id: string) {
        const rest = { ...breakoutGroups };
        delete rest[id];
        applyGroups(rest);
    }

    function renameBreakoutGroup(id: string, name: string) {
        applyGroups({ ...breakoutGroups, [id]: name });
    }

    return { breakoutGroups, addBreakoutGroup, removeBreakoutGroup, renameBreakoutGroup };
}
