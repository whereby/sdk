import { io } from "socket.io-client";
import adapterRaw from "webrtc-adapter";
import { ReconnectManager } from "./ReconnectManager";
import { KeepAliveManager } from "./KeepAliveManager";
import { PROTOCOL_RESPONSES } from "../model/protocol";
import { RtcManager } from "../webrtc";
import { RoomJoinedEvent, RoomJoinedErrors } from "./types";

// @ts-ignore
const adapter = adapterRaw.default ?? adapterRaw;

const DEFAULT_SOCKET_PATH = "/protocol/socket.io/v4";

const NOOP_KEEPALIVE_INTERVAL = 2000;
const DISCONNECT_DURATION_LIMIT_MS = 60000;

/**
 * Wrapper class that extends the Socket.IO client library.
 */
export class ServerSocket {
    _socket: any;
    _reconnectManager?: ReconnectManager | null;
    _keepAliveManager?: KeepAliveManager | null;
    noopKeepaliveInterval: any;
    _wasConnectedUsingWebsocket?: boolean;
    disconnectTimestamp: number | undefined;
    _disconnectDurationLimitExceeded: boolean;
    joinRoomFinished: boolean;
    _serverSideDisconnectDurationLimitOn: boolean;
    _disconnectDurationLimitOn: boolean;
    _disconnectDurationLimitEnabled: boolean;
    _disconnectDurationLimitInMs: number | undefined;
    _disconnectDurationLimitLatestTimestamp: number | undefined;

    constructor(
        hostName: string,
        optionsOverrides?: any,
        glitchFree = false,
        disconnectDurationLimitOn = false,
        serverSideDisconnectDurationLimitOn = false,
    ) {
        this._wasConnectedUsingWebsocket = false;
        this._disconnectDurationLimitOn = disconnectDurationLimitOn && !serverSideDisconnectDurationLimitOn;
        this._serverSideDisconnectDurationLimitOn = serverSideDisconnectDurationLimitOn;
        this._disconnectDurationLimitExceeded = false;
        this._reconnectManager = null;
        this._socket = io(hostName, {
            path: DEFAULT_SOCKET_PATH,
            randomizationFactor: 0.5,
            reconnectionDelay: 250,
            reconnectionDelayMax: 5000,
            timeout: 5000,
            transports: ["websocket"],
            withCredentials: true,
            ...optionsOverrides,
        });
        this._disconnectDurationLimitEnabled = false;
        this.joinRoomFinished = false;
        this._socket.io.on("reconnect", () => {
            if (
                this._disconnectDurationLimitOn &&
                this._didExceedDisconnectDurationLimit(this._disconnectDurationLimitLatestTimestamp)
            ) {
                this._socket.close();
                this._disconnectDurationLimitExceeded = true;
            }
            this._socket.sendBuffer = [];
        });
        this._socket.io.on("reconnect_attempt", () => {
            if (
                this._disconnectDurationLimitOn &&
                this._didExceedDisconnectDurationLimit(this._disconnectDurationLimitLatestTimestamp)
            ) {
                this._socket.close();
                this._disconnectDurationLimitExceeded = true;
            }
            if (this._wasConnectedUsingWebsocket) {
                this._socket.io.opts.transports = ["websocket"];
                // only fallback to polling if not safari
                // safari doesn't support cross domain cookies making load-balancer stickiness not work
                // and if socket.io reconnects to another signal instance with polling it will fail
                // remove if we move signal to a whereby.com subdomain
                if (adapter.browserDetails?.browser !== "safari") {
                    delete this._wasConnectedUsingWebsocket;
                }
            } else {
                this._socket.io.opts.transports = ["websocket", "polling"];
            }
        });

        if (glitchFree) this._reconnectManager = new ReconnectManager(this._socket);

        this._socket.on("room_joined", (payload: RoomJoinedEvent) => {
            const { error } = payload as RoomJoinedErrors;
            if (!error) {
                this.joinRoomFinished = true;
            }
        });

        this._socket.on("connect", () => {
            const transport = this.getTransport();
            if (transport === "websocket") {
                this._wasConnectedUsingWebsocket = true;

                // start noop keepalive loop to detect client side disconnects fast
                if (!this.noopKeepaliveInterval) {
                    let disconnectDurationLimitTimestampCandidate = Date.now();

                    this.noopKeepaliveInterval = setInterval(() => {
                        try {
                            // send a noop message if it thinks it is connected (might not be)
                            if (this._socket.connected) {
                                if (
                                    this._disconnectDurationLimitOn &&
                                    !this._didExceedDisconnectDurationLimit(disconnectDurationLimitTimestampCandidate)
                                ) {
                                    this._disconnectDurationLimitLatestTimestamp =
                                        disconnectDurationLimitTimestampCandidate;
                                    disconnectDurationLimitTimestampCandidate = Date.now();
                                }
                                if (!this._keepAliveManager) {
                                    this._socket.io.engine.sendPacket("noop");
                                }
                            }
                        } catch (ex) {}
                    }, NOOP_KEEPALIVE_INTERVAL);
                }
            }
        });

        this._socket.on("disconnect", () => {
            if (
                this._disconnectDurationLimitOn &&
                this._didExceedDisconnectDurationLimit(this._disconnectDurationLimitLatestTimestamp)
            ) {
                this._socket.close();
                this._disconnectDurationLimitExceeded = true;
            }

            this.joinRoomFinished = false;
            this.disconnectTimestamp = Date.now();
            if (this.noopKeepaliveInterval) {
                clearInterval(this.noopKeepaliveInterval);
                this.noopKeepaliveInterval = null;
            }
        });
    }

    _didExceedDisconnectDurationLimit(timestamp: number | undefined) {
        if (!timestamp || !this._disconnectDurationLimitOn || !this._disconnectDurationLimitEnabled) return false;

        const disconnectedDuration = Date.now() - timestamp;
        if (disconnectedDuration > DISCONNECT_DURATION_LIMIT_MS) {
            return true;
        }
        return false;
    }

    get disconnectDurationLimitExceeded(): boolean {
        if (this._serverSideDisconnectDurationLimitOn && this._keepAliveManager) {
            return this._keepAliveManager.disconnectDurationLimitExceeded;
        } else if (this._disconnectDurationLimitOn) {
            return this._disconnectDurationLimitExceeded;
        }
        return false;
    }

    enableDisconnectDurationLimit() {
        if (this._serverSideDisconnectDurationLimitOn) {
            this._keepAliveManager = new KeepAliveManager(this);
        } else if (this._disconnectDurationLimitOn) {
            this._disconnectDurationLimitEnabled = true;
        }
    }

    setRtcManager(rtcManager?: RtcManager) {
        if (this._reconnectManager) {
            this._reconnectManager.rtcManager = rtcManager;
        }
    }

    connect() {
        if (this.isConnected() || this.isConnecting()) {
            return;
        }
        this._socket.open();
    }

    disconnect() {
        this._socket.disconnect();
    }

    emit(eventName: string, ...args: any[]) {
        this._socket.emit.apply(this._socket, arguments);
    }

    getTransport() {
        return this._socket?.io?.engine?.transport?.name;
    }

    getManager() {
        return this._socket.io;
    }

    isConnecting() {
        return this._socket && this._socket.connecting;
    }

    isConnected() {
        return this._socket && this._socket.connected;
    }

    /**
     * Register a new event handler.
     *
     * @param {string} eventName - Name of the event to listen for.
     * @param {function} handler - The callback function that should be called for the event.
     * @returns {function} Function to deregister the listener.
     */
    on(eventName: string, handler: Function) {
        const relayableEvents = [
            PROTOCOL_RESPONSES.ROOM_JOINED,
            PROTOCOL_RESPONSES.CLIENT_LEFT,
            PROTOCOL_RESPONSES.NEW_CLIENT,
        ];

        // Intercept certain events if glitch-free is enabled.
        if (this._reconnectManager && relayableEvents.includes(eventName)) {
            return this._interceptEvent(eventName, handler);
        }

        this._socket.on(eventName, handler);

        return () => {
            this._socket.off(eventName, handler);
        };
    }

    onEngineEvent(eventName: string, handler: Function) {
        this._socket.io?.on(eventName, handler);
        return () => {
            this._socket.io?.off(eventName, handler);
        };
    }

    /**
     * Register a new event handler to be triggered only once.
     *
     * @param {string} eventName - Name of the event to listen for.
     * @param {function} handler - The function that should be called for the event.
     */
    once(eventName: string, handler: Function) {
        this._socket.once(eventName, handler);
    }

    /**
     * Deregister an event handler.
     *
     * @param {string} eventName - Name of the event the handler is registered for.
     * @param {function} handler - The callback that will be deregistered.
     */
    off(eventName: string, handler: Function) {
        this._socket.off(eventName, handler);
    }

    /**
     * Intercept event and let ReconnectManager handle them.
     */
    _interceptEvent(eventName: string, handler: any) {
        if (this._reconnectManager) {
            this._reconnectManager.on(eventName, handler);
        }

        return () => {
            if (this._reconnectManager) this._reconnectManager.removeListener(eventName, handler);
        };
    }

    getGlitchFreeMetrics() {
        return this._reconnectManager?.metrics;
    }

    getReconnectThreshold() {
        return this._reconnectManager?.reconnectThresholdInMs;
    }
}
