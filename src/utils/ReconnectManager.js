import EventEmitter from "events";
import { getUpdatedStats } from "../webrtc/stats/StatsMonitor/index";
import { PROTOCOL_EVENTS, PROTOCOL_RESPONSES } from "../model/protocol";

export class ReconnectManager extends EventEmitter {
    constructor(socket, logger = console) {
        super();
        this._socket = socket;
        this._logger = logger;
        this._clients = {};
        this._signalDisconnectTime = undefined;
        this.rtcManager = undefined;

        socket.on("disconnect", () => {
            this._signalDisconnectTime = Date.now();
        });

        // We intercept these events and take responsiblity for forwarding them
        socket.on(PROTOCOL_RESPONSES.ROOM_JOINED, (payload) => this._onRoomJoined(payload));
        socket.on(PROTOCOL_RESPONSES.NEW_CLIENT, (payload) => this._onNewClient(payload));
        socket.on(PROTOCOL_RESPONSES.CLIENT_LEFT, (payload) => this._onClientLeft(payload));

        // We intercept these events and handle them without forwarding them
        socket.on(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, (payload) => this._onPendingClientLeft(payload));

        // We gather information from these events but they will also be forwarded
        socket.on(PROTOCOL_RESPONSES.AUDIO_ENABLED, (payload) => this._onAudioEnabled(payload));
        socket.on(PROTOCOL_RESPONSES.VIDEO_ENABLED, (payload) => this._onVideoEnabled(payload));
        socket.on(PROTOCOL_RESPONSES.SCREENSHARE_STARTED, (payload) => this._onScreenshareChanged(payload, true));
        socket.on(PROTOCOL_RESPONSES.SCREENSHARE_STOPPED, (payload) => this._onScreenshareChanged(payload, false));
    }

    async _onRoomJoined(payload) {
        // We might have gotten an error
        if (!payload.room?.clients) {
            this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
            return;
        }

        if (!payload.selfId) {
            this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
            return;
        }

        const myDeviceId = payload.room.clients.find((c) => payload.selfId === c.id)?.deviceId;
        if (!myDeviceId) {
            this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
            return;
        }

        // Try to remove our own pending client if this is a page reload
        // Could also be a first normal room_joined which can never be glitch-free
        if (!this._signalDisconnectTime) {
            this._resetClientState(payload);
            payload.room.clients = payload.room.clients.filter(
                (c) => !(c.deviceId === myDeviceId && c.isPendingToLeave)
            );
            this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
            return;
        }

        // The threshold for trying glitch-free reconnect should be less than server-side configuration
        const RECONNECT_THRESHOLD = payload.disconnectTimeout * 0.8;
        const timeSinceDisconnect = Date.now() - this._signalDisconnectTime;
        if (timeSinceDisconnect > RECONNECT_THRESHOLD) {
            this._resetClientState(payload);
            this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
            return;
        }

        // At this point we want to try to attempt glitch-free reconnection experience

        // Filter out our own pending client after page reload
        payload.room.clients = payload.room.clients.filter((c) => !(c.deviceId === myDeviceId && c.isPendingToLeave));

        const allStats = await getUpdatedStats();
        payload.room.clients.forEach((client) => {
            try {
                if (client.id === payload.selfId) return;

                // Maybe add client to state
                if (!this._clients[client.id]) {
                    this._addClientToState(client);
                    return;
                }
                // Verify that rtcManager knows about the client
                if (!this.rtcManager?.hasClient(client.id)) {
                    return;
                }

                // Verify that the client state hasn't changed
                if (
                    this._hasClientStateChanged({
                        clientId: client.id,
                        webcam: client.isVideoEnabled,
                        mic: client.isAudioEnabled,
                        screenShare: client.streams.length > 1,
                    })
                ) {
                    return;
                }

                if (this._wasClientSendingMedia(client.id)) {
                    // Verify the client media is still flowing (not stopped from other end)
                    if (!this._isClientMediaActive(allStats, client.id)) {
                        return;
                    }
                }

                client.mergeWithOldClientState = true;
            } catch (error) {
                this._logger.error("Failed to evaluate if we should merge client state %o", error);
            }
        });

        // We will try to remove any remote client pending to leave
        payload.room.clients.forEach((c) => {
            if (c.isPendingToLeave) {
                this._onPendingClientLeft({ clientId: c.id });
            }
        });

        this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
    }

    _onClientLeft(payload) {
        const { clientId } = payload;
        const client = this._clients[clientId];

        // Remove client from state and clear timeout if client was pending to leave
        if (client) {
            clearTimeout(client.timeout);
            delete this._clients[clientId];
        }

        // Old RTCManager only takes one argument, so rest is ignored.
        this.rtcManager?.disconnect(clientId, /* activeBreakout */ null, payload.eventClaim);

        this.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, payload);
    }

    _onPendingClientLeft(payload) {
        const { clientId } = payload;
        const client = this._clients[clientId];

        if (!client) {
            this._logger.warn(`client ${clientId} not found`);
            return;
        }

        // We've already started the check below, don't do it again
        if (client.isPendingToLeave) {
            return;
        }

        client.isPendingToLeave = true;
        if (this._wasClientSendingMedia(clientId)) {
            client.checkActiveMediaAttempts = 0;
            this._abortIfNotActive(payload);
        }
    }

    _onNewClient(payload) {
        const {
            client: { id: clientId, deviceId },
        } = payload;

        const client = this._clients[clientId];
        if (client && client.isPendingToLeave) {
            clearTimeout(client.timeoutHandler);
            client.isPendingToLeave = false;
            return;
        }

        this._getPendingClientsByDeviceId(deviceId).forEach((client) => {
            clearTimeout(client.timeoutHandler);
            client.isPendingToLeave = undefined;
            this.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, { clientId: client.clientId });
        });

        this._addClientToState(payload.client);
        this.emit(PROTOCOL_RESPONSES.NEW_CLIENT, payload);
    }

    // Evaluate if we should send send client_left before getting it from signal-server
    async _abortIfNotActive(payload) {
        const { clientId } = payload;

        let client = this._clients[clientId];
        if (!client?.isPendingToLeave) return;

        client.checkActiveMediaAttempts++;
        if (client.checkActiveMediaAttempts > 3) {
            return;
        }

        const stillActive = await this._checkIsActive(clientId);
        if (stillActive) {
            client.timeoutHandler = setTimeout(() => this._abortIfNotActive(payload), 500);
            return;
        }

        client = this._clients[clientId];
        if (client?.isPendingToLeave) {
            clearTimeout(client.timeoutHandler);
            delete this._clients[clientId];
            this.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, payload);
        }
    }

    // Check if client is active
    async _checkIsActive(clientId) {
        const allStats = await getUpdatedStats();
        return this._isClientMediaActive(allStats, clientId);
    }

    // Check if client has bitrates for all tracks
    _isClientMediaActive(stats, clientId) {
        const clientStats = stats?.[clientId];
        let isActive = false;
        if (clientStats) {
            Object.entries(clientStats.tracks).forEach(([trackId, trackStats]) => {
                if (trackId !== "probator")
                    Object.values(trackStats.ssrcs).forEach((ssrcStats) => {
                        if ((ssrcStats.bitrate || 0) > 0) isActive = true;
                    });
            });
        }
        return isActive;
    }

    _onAudioEnabled(payload) {
        const { clientId, isAudioEnabled } = payload;
        this._clients[clientId] = {
            ...(this._clients[clientId] || {}),
            isAudioEnabled,
        };
    }

    _onVideoEnabled(payload) {
        const { clientId, isVideoEnabled } = payload;
        this._clients[clientId] = {
            ...(this._clients[clientId] || {}),
            isVideoEnabled,
        };
    }

    _onScreenshareChanged(payload, action) {
        const { clientId } = payload;
        this._clients[clientId] = {
            ...(this._clients[clientId] || {}),
            isScreenshareEnabled: action,
        };
    }

    _hasClientStateChanged({ clientId, webcam, mic, screenShare }) {
        const state = this._clients[clientId];

        if (!state) {
            throw new Error(`Client ${clientId} not found in ReconnectManager state`);
        }

        if (webcam !== state.isVideoEnabled) {
            return true;
        }
        if (mic !== state.isAudioEnabled) {
            return true;
        }
        if (screenShare !== state.isScreenshareEnabled) {
            return true;
        }

        return false;
    }

    _addClientToState(newClient) {
        this._clients[newClient.id] = {
            ...(this._clients[newClient.id] || {}),
            isAudioEnabled: newClient.isAudioEnabled,
            isVideoEnabled: newClient.isVideoEnabled,
            isScreenshareEnabled: newClient.streams.length > 1,
            deviceId: newClient.deviceId,
            isPendingToLeave: newClient.isPendingToLeave,
            clientId: newClient.id,
        };
    }

    _wasClientSendingMedia(clientId) {
        const client = this._clients[clientId];

        if (!client) {
            throw new Error(`Client ${clientId} not found in ReconnectManager state`);
        }

        return client.isAudioEnabled || client.isVideoEnabled || client.isScreenshareEnabled;
    }

    _getPendingClientsByDeviceId(deviceId) {
        return Object.values(this._clients).filter((clientState) => {
            return clientState.deviceId === deviceId && clientState.isPendingToLeave;
        });
    }

    _resetClientState(payload) {
        this._clients = {};
        payload.room.clients.forEach((client) => {
            if (client.id === payload.selfId) {
                return;
            } else {
                this._addClientToState(client);
            }
        });
    }
}
