import type { EventEmitter } from "events";
import type { Request, Response } from "express";

export type WebhookEventType =
    | "assistant.requested"
    | "room.client.joined"
    | "room.client.left"
    | "room.session.started"
    | "room.session.ended";

export const TRIGGER_EVENT_SUCCESS = "trigger_event_success";

interface WherebyWebhookBase {
    type: WebhookEventType;
    apiVersion: "1.0";
    id: string;
    createdAt: string;
}

interface WherebyWebhookInRoom {
    meetingId: string;
    roomName: string;
    roomSessionId: string | null;
    subdomain: string;
}

interface WherebyWebhookDataClient {
    displayName: string;
    participantId: string;
    metadata: string | null;
    externalId: string | null;
}

export type WherebyRoleName =
    | "owner"
    | "member"
    | "host"
    | "visitor"
    | "granted_visitor"
    | "viewer"
    | "granted_viewer"
    | "recorder"
    | "streamer"
    | "captioner"
    | "assistant";

interface WherebyWebhookDataClientJoinLeave {
    roleName: WherebyRoleName;
    numClients: number;
    numClientsByRoleName: Record<WherebyRoleName, number>;
}

export interface WherebyWebhookAssistantRequested extends WherebyWebhookBase {
    data: WherebyWebhookInRoom;
}

export interface WherebyWebhookRoomClientJoined extends WherebyWebhookBase {
    data: WherebyWebhookInRoom & WherebyWebhookDataClientJoinLeave & WherebyWebhookDataClient;
}

export interface WherebyWebhookRoomClientLeft extends WherebyWebhookBase {
    data: WherebyWebhookInRoom & WherebyWebhookDataClientJoinLeave & WherebyWebhookDataClient;
}

export interface WherebyWebhookRoomSessionStarted extends WherebyWebhookBase {
    data: WherebyWebhookInRoom;
}

export interface WherebyWebhookRoomSessionEnded extends WherebyWebhookBase {
    data: WherebyWebhookInRoom;
}

export type TriggerEvents = {
    [TRIGGER_EVENT_SUCCESS]: [{ roomUrl: string; triggerWebhook: WherebyWebhookType }];
};

export type WherebyWebhookType =
    | WherebyWebhookAssistantRequested
    | WherebyWebhookRoomClientJoined
    | WherebyWebhookRoomClientLeft
    | WherebyWebhookRoomSessionStarted
    | WherebyWebhookRoomSessionEnded;

export type WherebyWebhookTriggerTypes = {
    "assistant.requested": WherebyWebhookAssistantRequested;
    "room.client.joined": WherebyWebhookRoomClientJoined;
    "room.client.left": WherebyWebhookRoomClientLeft;
    "room.session.started": WherebyWebhookRoomSessionStarted;
    "room.session.ended": WherebyWebhookRoomSessionEnded;
};

export type WherebyWebhookTriggers = Partial<{
    [Type in keyof WherebyWebhookTriggerTypes]: (data: WherebyWebhookTriggerTypes[Type]) => Promise<boolean> | boolean;
}>;

export type WherebyWebHookHandlers = {
    [Type in keyof WherebyWebhookTriggerTypes]: (
        req: Request<never, never, WherebyWebhookTriggerTypes[Type], never>,
        res: Response,
        emitter: EventEmitter<TriggerEvents>,
    ) => void;
};
