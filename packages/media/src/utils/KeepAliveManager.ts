import type { ServerSocket } from "./ServerSocket";

export const DISCONNECT_DURATION_LIMIT_MS = 60000;
export const SIGNAL_PING_INTERVAL = 2000; // pingInterval set on server-side
export const SIGNAL_PING_MAX_LATENCY = 1000; // network latency > 1 second is very unhealthy

export class KeepAliveManager {
    private serverSocket: ServerSocket;

    private pingTimer: ReturnType<typeof setTimeout> | undefined;
    public lastPingTimestamp = Date.now();

    private _disconnectDurationLimitEnabled = false;
    public disconnectDurationLimitExceeded = false;

    constructor(serverSocket: ServerSocket) {
        this.serverSocket = serverSocket;

        this.serverSocket.on("connect", () => this.onConnect());
        this.serverSocket.onEngineEvent("ping", () => this.onPing());
        this.serverSocket.on("disconnect", () => this.onDisconnect());
        this.serverSocket.onEngineEvent("reconnect_attempt", () => this.onReconnectAttempt());
    }

    public enableDisconnectDurationLimit() {
        this._disconnectDurationLimitEnabled = true;
    }

    private pingHeartbeat() {
        clearTimeout(this.pingTimer);

        this.pingTimer = setTimeout(() => {
            if (this.serverSocket._socket.io.engine.readyState === "closed") return;

            // try sending a noop message if socket still thinks it is connected (might not be)
            // If this fails it will trigger the websocket reconnection flow.
            this.serverSocket._socket.io.engine.sendPacket("noop");
        }, SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY);

        this.lastPingTimestamp = Date.now();
    }

    private onConnect() {
        this.pingHeartbeat();
    }

    private onPing() {
        this.pingHeartbeat();
    }

    private onDisconnect() {
        clearTimeout(this.pingTimer);
    }

    private onReconnectAttempt() {
        if (this._disconnectDurationLimitEnabled) {
            this.disconnectDurationLimitExceeded = Boolean(
                Date.now() - this.lastPingTimestamp > DISCONNECT_DURATION_LIMIT_MS,
            );

            if (this.disconnectDurationLimitExceeded) {
                // Permanently close the websocket and prevent reconnection flow
                this.serverSocket.disconnect();
            }
        }
    }
}
