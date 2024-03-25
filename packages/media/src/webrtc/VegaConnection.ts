import SfuV2Parser from "./SfuV2Parser";
import { EventEmitter } from "events";
import Logger from "../utils/Logger";

const logger = new Logger();

export default class VegaConnection extends EventEmitter {
    wsUrl: string;
    protocol: string;
    socket: WebSocket | null = null;
    sents: Map<any, any>;

    constructor(wsUrl: string, protocol = "whereby-sfu#v4") {
        super();

        this.wsUrl = wsUrl;
        this.protocol = protocol;

        // This is the map of sent requests that are waiting for a response
        this.sents = new Map();
        this._setupSocket();
    }

    _setupSocket() {
        this.socket = new WebSocket(this.wsUrl, this.protocol);
        this.socket.onopen = this._onOpen.bind(this);
        this.socket.onmessage = this._onMessage.bind(this);
        this.socket.onclose = this._onClose.bind(this);
        this.socket.onerror = this._onError.bind(this);
    }

    _tearDown() {
        if (this.socket === null) return;

        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket = null;

        this.sents.forEach((sent) => sent.close());

        this.emit("close");
    }

    close() {
        this.socket?.close();
    }

    _onOpen() {
        logger.info("Connected");

        this.emit("open");
    }

    _onMessage(event: any) {
        const socketMessage = SfuV2Parser.parse(event.data);

        logger.info("Received message", socketMessage);

        if (socketMessage?.response) {
            this._handleResponse(socketMessage);
        } else if (socketMessage?.message) {
            this.emit("message", socketMessage);
        }
    }

    _onClose() {
        logger.info("Disconnected");

        this._tearDown();
    }

    _onError(error: any) {
        logger.info("Error", error);
    }

    _handleResponse(socketMessage: any) {
        const sent = this.sents.get(socketMessage.id);

        if (socketMessage.ok) {
            sent.resolve(socketMessage.data);
        } else {
            const error = new Error(socketMessage.errorReason);
            sent.reject(error);
        }
    }

    send(message: any) {
        try {
            if (this.socket) {
                this.socket.send(JSON.stringify(message));
            }
        } catch (error) {}
    }

    message(method: any, data: any = {}) {
        const message = SfuV2Parser.createMessage(method, data);
        this.send(message);
    }

    request(method: any, data: any = {}, timeout: number = 1500 * (15 + 0.1 * this.sents.size)) {
        const request = SfuV2Parser.createRequest(method, data);

        this.send(request);

        return new Promise((pResolve, pReject) => {
            const sent = {
                id: request.id,
                method: request.method,
                resolve: (data2: any) => {
                    if (!this.sents.delete(request.id)) return;

                    clearTimeout(sent.timer);
                    pResolve(data2);
                },
                reject: (error: any) => {
                    if (!this.sents.delete(request.id)) return;

                    clearTimeout(sent.timer);
                    pReject(error);
                },
                timer: setTimeout(() => {
                    if (!this.sents.delete(request.id)) return;

                    pReject(new Error("request timeout"));
                }, timeout),
                close: () => {
                    clearTimeout(sent.timer);
                    pReject(new Error("transport closed"));
                },
            };

            this.sents.set(request.id, sent);
        });
    }
}
