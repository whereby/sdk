import { EventEmitter } from "events";
import express, { type Request, type Response } from "express";
import assert from "assert";
import bodyParser from "body-parser";

import {
    type WherebyWebhookType,
    type WherebyWebhookTriggers,
    type TriggerEvents,
    ASSISTANT_JOIN_SUCCESS,
} from "./types.js";

import { buildRoomUrl } from "../utils/buildRoomUrl.js";
import { Assistant } from "../Assistant";

export * from "./types.js";

export interface TriggerOptions {
    webhookTriggers: WherebyWebhookTriggers;
    subdomain: string;
    port?: number;
}

const webhookRouter = (
    webhookTriggers: WherebyWebhookTriggers,
    subdomain: string,
    emitter: EventEmitter<TriggerEvents>,
) => {
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
            const roomUrl = buildRoomUrl(req.body.data.roomName, subdomain);

            const assistant = new Assistant({ startCombinedAudioStream: true });
            assistant.joinRoom(roomUrl);

            emitter.emit(ASSISTANT_JOIN_SUCCESS, { roomUrl, triggerWebhook: req.body, assistant });
        }

        res.status(200);
        res.end();
    });

    return router;
};

export class Trigger extends EventEmitter<TriggerEvents> {
    private webhookTriggers: WherebyWebhookTriggers;
    private subdomain: string;
    private port: number;

    constructor({ webhookTriggers = {}, subdomain, port = 4999 }: TriggerOptions) {
        super();

        this.webhookTriggers = webhookTriggers;
        this.subdomain = subdomain;
        this.port = port;
    }

    start() {
        const app = express();

        const router = webhookRouter(this.webhookTriggers, this.subdomain, this);

        app.use(router);

        const server = app.listen(this.port, () => {
            // console.log(`Bot trigger server now running on port[${this.port}]`);
        });

        process.on("SIGTERM", () => {
            server.close();
        });
    }
}
