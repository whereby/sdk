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
    port?: number;
    assistantKey?: string;
    startCombinedAudioStream?: boolean;
    startLocalMedia?: boolean;
}

const webhookRouter = (
    webhookTriggers: WherebyWebhookTriggers,
    emitter: EventEmitter<TriggerEvents>,
    assistantKey?: string,
    startCombinedAudioStream = false,
    startLocalMedia = false,
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
            const roomUrl = buildRoomUrl(req.body.data.roomName, req.body.data.subdomain);

            const assistant = new Assistant({ assistantKey, startCombinedAudioStream, startLocalMedia });
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
    private port: number;
    private assistantKey?: string;
    private startCombinedAudioStream: boolean;
    private startLocalMedia: boolean;

    constructor({
        webhookTriggers = {},
        port = 4999,
        assistantKey,
        startCombinedAudioStream,
        startLocalMedia,
    }: TriggerOptions) {
        super();

        this.webhookTriggers = webhookTriggers;
        this.port = port;
        this.assistantKey = assistantKey;
        this.startCombinedAudioStream = startCombinedAudioStream ?? false;
        this.startLocalMedia = startLocalMedia ?? false;
    }

    start() {
        const app = express();

        const router = webhookRouter(
            this.webhookTriggers,
            this,
            this.assistantKey,
            this.startCombinedAudioStream,
            this.startLocalMedia,
        );

        app.use(router);

        const server = app.listen(this.port, () => {
            // console.log(`Bot trigger server now running on port[${this.port}]`);
        });

        process.on("SIGTERM", () => {
            server.close();
        });
    }
}
