import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BreakoutActions, BreakoutState, LocalParticipant } from "./types";

const MOVE_TO_GROUP_TOAST = "breakoutMoveToGroup";
const MOVE_TO_MAIN_TOAST = "breakoutMoveToMain";

function secondsUntil(deadline: number | null): number | null {
    if (deadline == null) return null;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

export function useBreakoutNotifications({
    breakout,
    localParticipant,
    joinBreakoutGroup,
    joinBreakoutMainRoom,
}: {
    breakout: BreakoutState;
    localParticipant?: LocalParticipant;
    joinBreakoutGroup: BreakoutActions["joinBreakoutGroup"];
    joinBreakoutMainRoom: BreakoutActions["joinBreakoutMainRoom"];
}) {
    const assigned = localParticipant?.breakoutGroupAssigned || "";
    const currentGroup = localParticipant?.breakoutGroup || "";
    const groupName = (id: string) => breakout.groups?.[id] || "your group";

    const moveToGroupDeadline = assigned && currentGroup !== assigned ? breakout.moveToGroupAt : null;
    const moveToMainDeadline = currentGroup ? breakout.moveToMainAt : null;

    const [, setTick] = useState(0);
    const hasCountdown = moveToGroupDeadline != null || moveToMainDeadline != null;
    useEffect(() => {
        if (!hasCountdown) return;
        const interval = setInterval(() => setTick((t) => t + 1), 500);
        return () => clearInterval(interval);
    }, [hasCountdown]);

    const groupRemaining = secondsUntil(moveToGroupDeadline);
    useEffect(() => {
        if (groupRemaining == null || groupRemaining <= 0) {
            toast.dismiss(MOVE_TO_GROUP_TOAST);
            return;
        }
        toast(
            () => (
                <span>
                    You've been assigned to {groupName(assigned)}. Joining in {groupRemaining}s{" "}
                    <button onClick={() => joinBreakoutGroup(assigned)}>Join now</button>
                </span>
            ),
            { id: MOVE_TO_GROUP_TOAST, icon: "⏳", duration: Infinity },
        );
    }, [groupRemaining, assigned]);

    const mainRemaining = secondsUntil(moveToMainDeadline);
    useEffect(() => {
        if (mainRemaining == null || mainRemaining <= 0) {
            toast.dismiss(MOVE_TO_MAIN_TOAST);
            return;
        }
        toast(
            () => (
                <span>
                    Session ended — leaving {groupName(currentGroup)} in {mainRemaining}s{" "}
                    <button onClick={() => joinBreakoutMainRoom()}>Leave now</button>
                </span>
            ),
            { id: MOVE_TO_MAIN_TOAST, icon: "⏳", duration: Infinity },
        );
    }, [mainRemaining]);

    useEffect(() => {
        return () => {
            toast.dismiss(MOVE_TO_GROUP_TOAST);
            toast.dismiss(MOVE_TO_MAIN_TOAST);
        };
    }, []);
}
