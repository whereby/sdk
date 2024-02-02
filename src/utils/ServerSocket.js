import { io } from "socket.io-client";
import adapter from "webrtc-adapter";
import { ReconnectManager } from "./ReconnectManager";
import { PROTOCOL_RESPONSES } from "../model/protocol";

const DEFAULT_SOCKET_PATH = "/protocol/socket.io/v4";

const NOOP_KEEPALIVE_INTERVAL = 2000;

/**
 * Wrapper class that extends the Socket.IO client library.
 */
export default class ServerSocket {
    constructor(hostName, optionsOverrides, glitchFree) {
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
        this._socket.io.on("reconnect", () => {
            this._socket.sendBuffer = [];
        });
        this._socket.io.on("reconnect_attempt", () => {
            if (this._wasConnectedUsingWebsocket) {
                this._socket.io.opts.transports = ["websocket"];
                // only fallback to polling if not safari
                // safari doesn't support cross doamin cookies making load-balancer stickiness not work
                // and if socket.io reconnects to another signal instance with polling it will fail
                // remove if we move signal to a whereby.com subdomain
                if (adapter.browserDetails.browser !== "safari") delete this._wasConnectedUsingWebsocket;
            } else {
                this._socket.io.opts.transports = ["websocket", "polling"];
            }
        });

        if (glitchFree) this._reconnectManager = new ReconnectManager(this._socket);

        this._socket.on("connect", () => {
            const transport = this.getTransport();
            if (transport === "websocket") {
                this._wasConnectedUsingWebsocket = true;

                // start noop keepalive loop to detect client side disconnects fast
                if (!this.noopKeepaliveInterval)
                    this.noopKeepaliveInterval = setInterval(() => {
                        try {
                            // send a noop message if it thinks it is connected (might not be)
                            if (this._socket.connected) {
                                this._socket.io.engine.sendPacket("noop");
                            }
                        } catch (ex) {}
                    }, NOOP_KEEPALIVE_INTERVAL);
            }
        });

        this._socket.on("disconnect", () => {
            if (this.noopKeepaliveInterval) {
                clearInterval(this.noopKeepaliveInterval);
                this.noopKeepaliveInterval = null;
            }
        });
    }

    setRtcManager(rtcManager) {
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

    disconnectOnConnect() {
        this._socket.once("connect", () => {
            this._socket.disconnect();
        });
    }

    emit() {
        this._socket.emit.apply(this._socket, arguments);
    }

    emitIfConnected(eventName, data) {
        if (!this.isConnected()) {
            return;
        }
        this.emit(eventName, data);
    }

    getTransport() {
        return (
            this._socket &&
            this._socket.io &&
            this._socket.io.engine &&
            this._socket.io.engine.transport &&
            this._socket.io.engine.transport.name
        );
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
    on(eventName, handler) {
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

    /**
     * Register a new event handler to be triggered only once.
     *
     * @param {string} eventName - Name of the event to listen for.
     * @param {function} handler - The function that should be called for the event.
     */
    once(eventName, handler) {
        this._socket.once(eventName, handler);
    }

    /**
     * Deregister an event handler.
     *
     * @param {string} eventName - Name of the event the handler is registered for.
     * @param {function} handler - The callback that will be deregistered.
     */
    off(eventName, handler) {
        this._socket.off(eventName, handler);
    }

    /**
     * Intercept event and let ReconnectManager handle them.
     */
    _interceptEvent(eventName, handler) {
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
}
