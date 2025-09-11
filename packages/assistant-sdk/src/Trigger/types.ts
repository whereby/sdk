import type { EventEmitter } from "events";
import type { Request, Response } from "express";
import { Assistant } from "../Assistant";

export type WebhookType = "room.client.joined" | "room.client.left" | "room.session.started" | "room.session.ended";

export const ASSISTANT_JOIN_SUCCESS = "ASSISTANT_JOIN_SUCCESS";

interface WherebyWebhookBase {
    type: WebhookType;
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
    [ASSISTANT_JOIN_SUCCESS]: [{ roomUrl: string; triggerWebhook: WherebyWebhookType; assistant: Assistant }];
};

export type WherebyWebhookType =
    | WherebyWebhookRoomClientJoined
    | WherebyWebhookRoomClientLeft
    | WherebyWebhookRoomSessionStarted
    | WherebyWebhookRoomSessionEnded;

export type WherebyWebhookTriggerTypes = {
    "room.client.joined": WherebyWebhookBase;
    "room.client.left": WherebyWebhookBase;
    "room.session.started": WherebyWebhookRoomSessionStarted;
    "room.session.ended": WherebyWebhookBase;
};

export type WherebyWebhookTriggers = Partial<{
    [Type in keyof WherebyWebhookTriggerTypes]: (data: WherebyWebhookTriggerTypes[Type]) => boolean;
}>;

export type WherebyWebHookHandlers = {
    [Type in keyof WherebyWebhookTriggerTypes]: (
        req: Request<never, never, WherebyWebhookTriggerTypes[Type], never>,
        res: Response,
        emitter: EventEmitter<TriggerEvents>,
    ) => void;
};
