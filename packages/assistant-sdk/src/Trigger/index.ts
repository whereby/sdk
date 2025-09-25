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
} from "./types.js";

import { buildRoomUrl } from "../utils/buildRoomUrl.js";

export * from "./types.js";

export interface TriggerOptions {
    webhookTriggers: WherebyWebhookTriggers;
    port?: number;
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

        let shouldTriggerOnReceivedWebhook: boolean = false;

        switch (req.body.type) {
            case "room.client.joined":
                shouldTriggerOnReceivedWebhook =
                    (await webhookTriggers["room.client.joined"]?.(req.body as WherebyWebhookRoomClientJoined)) ??
                    false;
                break;
            case "room.client.left":
                shouldTriggerOnReceivedWebhook =
                    (await webhookTriggers["room.client.left"]?.(req.body as WherebyWebhookRoomClientLeft)) ?? false;
                break;
            case "room.session.started":
                shouldTriggerOnReceivedWebhook =
                    (await webhookTriggers["room.session.started"]?.(req.body as WherebyWebhookRoomSessionStarted)) ??
                    false;
                break;
            case "room.session.ended":
                shouldTriggerOnReceivedWebhook =
                    (await webhookTriggers["room.session.ended"]?.(req.body as WherebyWebhookRoomSessionEnded)) ??
                    false;
                break;
        }

        if (shouldTriggerOnReceivedWebhook) {
            const roomUrl = buildRoomUrl(req.body.data.roomName, req.body.data.subdomain);

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
