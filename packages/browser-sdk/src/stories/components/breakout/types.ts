import { RoomConnectionState } from "@whereby.com/core";
import { RoomConnectionActions } from "../../../lib/react/useRoomConnection/types";

export type BreakoutState = RoomConnectionState["breakout"];
export type LocalParticipant = NonNullable<RoomConnectionState["localParticipant"]>;
export type RemoteParticipant = RoomConnectionState["remoteParticipants"][number];
export type SpotlightedParticipant = RoomConnectionState["spotlightedParticipants"][number];

export type BreakoutActions = Pick<
    RoomConnectionActions,
    | "joinBreakoutGroup"
    | "joinBreakoutMainRoom"
    | "startBreakoutSession"
    | "updateBreakoutSession"
    | "stopBreakoutSession"
    | "assignBreakoutParticipants"
    | "assignAllBreakoutParticipants"
    | "unassignAllBreakoutParticipants"
    | "shuffleBreakoutParticipants"
    | "extendBreakoutTimer"
    | "stopBreakoutTimer"
    | "broadcastToGroups"
    | "stopBroadcastToGroups"
>;

export type BreakoutGroups = { [groupId: string]: string };
