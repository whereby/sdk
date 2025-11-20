import { EventEmitter } from "events";
import express, { type Request, type Response } from "express";
import assert from "assert";
import bodyParser from "body-parser";

import {
    type WherebyWebhookType,
    type WherebyWebhookTriggers,
    type TriggerEvents,
    TRIGGER_EVENT_SUCCESS,
    WherebyWebhookRoomClientJoined,
    WherebyWebhookRoomSessionStarted,
    WherebyWebhookRoomClientLeft,
    WherebyWebhookRoomSessionEnded,
    WherebyWebhookAssistantRequested,
    WebhookEventType,
} from "./types.js";

import { buildRoomUrl } from "../utils/buildRoomUrl.js";

export * from "./types.js";

export interface TriggerOptions {
    webhookTriggers: WherebyWebhookTriggers;
    port?: number;
}

async function calculateTrigger({
    body: rawBody,
    eventType,
    webhookTriggers,
}: {
    body: WherebyWebhookType;
    eventType: WebhookEventType;
    webhookTriggers: WherebyWebhookTriggers;
}): Promise<{ data: WherebyWebhookType["data"]; shouldTriggerOnReceivedWebhook: boolean } | null> {
    if (!webhookTriggers[eventType]) {
        return null;
    }
    switch (eventType) {
        case "assistant.requested": {
            const body = rawBody as WherebyWebhookAssistantRequested;
            const trigger = webhookTriggers["assistant.requested"]!;
            return {
                data: body.data,
                shouldTriggerOnReceivedWebhook: await trigger(body),
            };
        }
        case "room.client.joined": {
            const body = rawBody as WherebyWebhookRoomClientJoined;
            const trigger = webhookTriggers["room.client.joined"]!;
            return {
                data: body.data,
                shouldTriggerOnReceivedWebhook: await trigger(body),
            };
        }
        case "room.client.left": {
            const body = rawBody as WherebyWebhookRoomClientLeft;
            const trigger = webhookTriggers["room.client.left"]!;
            return {
                data: body.data,
                shouldTriggerOnReceivedWebhook: await trigger(body),
            };
        }
        case "room.session.started": {
            const body = rawBody as WherebyWebhookRoomSessionStarted;
            const trigger = webhookTriggers["room.session.started"]!;
            return {
                data: body.data,
                shouldTriggerOnReceivedWebhook: await trigger(body),
            };
        }
        case "room.session.ended": {
            const body = rawBody as WherebyWebhookRoomSessionEnded;
            const trigger = webhookTriggers["room.session.ended"]!;
            return {
                data: body.data,
                shouldTriggerOnReceivedWebhook: await trigger(body),
            };
        }
    }
}

const webhookRouter = (webhookTriggers: WherebyWebhookTriggers, emitter: EventEmitter<TriggerEvents>) => {
    const router = express.Router();

    const jsonParser = bodyParser.json();

    router.get("/", (_, res) => {
        res.status(200);
        res.end();
    });

    router.post("/", jsonParser, async (req: Request<never, never, WherebyWebhookType, never>, res: Response) => {
        assert(req.body, "message body is required");
        assert("type" in req.body, "webhook type is required");

        const result = await calculateTrigger({
            body: req.body,
            eventType: req.body.type,
            webhookTriggers,
        });
        if (result?.shouldTriggerOnReceivedWebhook) {
            const { data } = result;
            const roomUrl = buildRoomUrl(data.roomName, data.subdomain);

            emitter.emit(TRIGGER_EVENT_SUCCESS, { roomUrl, triggerWebhook: req.body });
        }

        res.status(200);
        res.end();
    });

    return router;
};

export class Trigger extends EventEmitter<TriggerEvents> {
    private webhookTriggers: WherebyWebhookTriggers;
    private port: number;

    constructor({ webhookTriggers = {}, port = 8080 }: TriggerOptions) {
        super();

        this.webhookTriggers = webhookTriggers;
        this.port = port;
    }

    start() {
        const app = express();

        const router = webhookRouter(this.webhookTriggers, this);

        app.use(router);

        app.listen(this.port).on("error", (error) => {
            console.error("Could not start Trigger web server", error);
        });
    }
}
