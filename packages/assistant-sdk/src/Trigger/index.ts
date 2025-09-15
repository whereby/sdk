import { EventEmitter } from "events";
import express, { type Request, type Response } from "express";
import assert from "assert";
import bodyParser from "body-parser";

import {
    type WherebyWebhookType,
    type WherebyWebhookTriggers,
    type TriggerEvents,
    TRIGGER_EVENT_SUCCESS,
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

    router.post("/", jsonParser, (req: Request<never, never, WherebyWebhookType, never>, res: Response) => {
        assert(req.body, "message body is required");
        assert("type" in req.body, "webhook type is required");

        const shouldTriggerOnReceivedWebhook = webhookTriggers[req.body.type]?.(req.body);

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

        const server = app.listen(this.port, () => {
            // console.log(`Bot trigger server now running on port[${this.port}]`);
        });

        process.on("SIGTERM", () => {
            server.close();
        });
    }
}
