import EventEmitter from "events";
import { getUpdatedStats } from "../webrtc/stats/StatsMonitor/index";
import { PROTOCOL_EVENTS, PROTOCOL_RESPONSES } from "../model/protocol";

export class ReconnectManager extends EventEmitter {
    constructor(socket, logger = console) {
        super();
        this._socket = socket;
        this._logger = logger;
        this._clients = new Map();
        this._signalDisconnectTime = undefined;
        this.rtcManager = undefined;

        socket.on("disconnect", () => {
            this._signalDisconnectTime = Date.now();
        });

        // We intercept these events and take responsiblity for forwarding them.
        socket.on(PROTOCOL_RESPONSES.ROOM_JOINED, (payload) => this._onRoomJoined(payload));
        socket.on(PROTOCOL_RESPONSES.NEW_CLIENT, (payload) => this._onNewClient(payload));
        socket.on(PROTOCOL_RESPONSES.CLIENT_LEFT, (payload) => this._onClientLeft(payload));

        // We intercept these events and handle them without forwarding them.
        socket.on(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, (payload) => this._onPendingClientLeft(payload));

        // We gather information from these events but they will also be forwarded.
        socket.on(PROTOCOL_RESPONSES.AUDIO_ENABLED, (payload) => this._onAudioEnabled(payload));
        socket.on(PROTOCOL_RESPONSES.VIDEO_ENABLED, (payload) => this._onVideoEnabled(payload));
        socket.on(PROTOCOL_RESPONSES.SCREENSHARE_STARTED, (payload) => this._onScreenshareChanged(payload, true));
        socket.on(PROTOCOL_RESPONSES.SCREENSHARE_STOPPED, (payload) => this._onScreenshareChanged(payload, false));
    }

    async _onRoomJoined(payload) {
        // the threshold for trying glitch-free reconnect should be less than server-side configuration
        const RECONNECT_THRESHOLD = payload.disconnectTimeout * 0.8;
        if (Date.now() - (this._signalDisconnectTime || 0) > RECONNECT_THRESHOLD) {
            this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
            return;
        }

        const allStats = await getUpdatedStats();

        const clientsToIgnore = [];

        payload.room.clients.forEach((newClient) => {
            try {
                if (newClient.id === payload.selfId) return;

                // Any client pending to leave will be removed from payload.
                if (newClient.isPendingToLeave) {
                    return clientsToIgnore.push(newClient.id);
                }

                // Maybe add client to state
                if (!this._clients.has(newClient.id)) {
                    this._addClientToState(newClient);
                    return;
                }

                // Verify that rtcManager knows about the client
                if (!this.rtcManager.hasClient(newClient.id)) {
                    return;
                }

                // Verify what the client state hasn't changed
                if (
                    this._hasClientStateChanged({
                        clientId: newClient.id,
                        webcam: newClient.isVideoEnabled,
                        mic: newClient.isAudioEnabled,
                        screenShare: newClient.streams.length > 1,
                    })
                ) {
                    return;
                }

                if (this._wasClientSendingMedia(newClient.id)) {
                    // verify the client media is still flowing (not stopped from other end)
                    if (!this._isClientMediaActive(allStats, newClient.id)) {
                        return;
                    }
                }

                newClient.mergeWithOldClientState = true;
            } catch (error) {
                this._logger.error("Failed to evaluate if we should merge client state %o", error);
            }
        });

        payload.room.clients = payload.room.clients.filter((c) => !clientsToIgnore.includes(c.id));

        this.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
    }

    _onClientLeft(payload) {
        const { clientId } = payload;
        const c = this._clients.get(clientId);

        // remove client from state and clear timeout if client was pending to leave
        if (c) {
            clearTimeout(c.timeout);
            this._clients.delete(clientId);
        }

        // Old RTCManager only takes one argument, so rest is ignored.
        this.rtcManager.disconnect(clientId, /* activeBreakout */ null, payload.eventClaim);

        // TODO: is it fine to retransmit client_left if we already did it following a pending_client_left?
        this.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, payload);
    }

    _onPendingClientLeft(payload) {
        const { clientId } = payload;
        const client = this._clients.get(clientId);

        if (!client) {
            this._logger.warn(`client ${clientId} not found`);
            return;
        }

        client.isPendingToLeave = true;
        if (this._wasClientSendingMedia(clientId)) {
            client.checkActiveMediaAttempts = 0;
            client.timeoutHandler = setTimeout(() => this._abortIfNotActive(payload), 500);
        }
    }

    _onNewClient(payload) {
        const {
            client: { id: clientId, deviceId },
        } = payload;

        let client = this._clients.get(clientId);
        if (client && client.isPendingToLeave) {
            clearTimeout(client.timeoutHandler);
            client.isPendingToLeave = false;
            return;
        }

        client = this._getPendingClientByDeviceId(deviceId);
        if (client) {
            clearTimeout(client.timeoutHandler);
            client.isPendingToLeave = undefined;
            this.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, { clientId: client.clientId });
        }

        this._addClientToState(payload.client);
        this.emit(PROTOCOL_RESPONSES.NEW_CLIENT, payload);
    }

    // evaluate if we should send send client_left before getting it from signal-server
    async _abortIfNotActive(payload) {
        const { clientId } = payload;

        let client = this._clients.get(clientId);
        if (!client.isPendingToLeave) return;

        client.checkActiveMediaAttempts++;
        if (client.checkActiveMediaAttempts > 3) {
            return;
        }

        const stillActive = await this._checkIsActive(clientId);
        if (stillActive) {
            client.timeoutHandler = setTimeout(() => this._abortIfNotActive(payload), 500);
            return;
        }

        client = this._clients.get(clientId);
        if (client.isPendingToLeave) {
            clearTimeout(client.timeoutHandler);
            this._clients.delete(clientId);
            this.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, payload);
        }
    }

    // check if client is active
    async _checkIsActive(clientId) {
        const allStats = await getUpdatedStats();
        return this._isClientMediaActive(allStats, clientId);
    }

    // checks if client has bitrates for all tracks
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

        const state = this._clients.get(clientId);
        state.isAudioEnabled = isAudioEnabled;
    }

    _onVideoEnabled(payload) {
        const { clientId, isVideoEnabled } = payload;

        const state = this._clients.get(clientId);
        state.isVideoEnabled = isVideoEnabled;
    }

    _onScreenshareChanged(payload, action) {
        const { clientId } = payload;

        const state = this._clients.get(clientId);
        state.isScreenshareEnabled = action;
    }

    _hasClientStateChanged({ clientId, webcam, mic, screenShare }) {
        const state = this._clients.get(clientId);

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
        this._clients.set(newClient.id, {
            isAudioEnabled: newClient.isAudioEnabled,
            isVideoEnabled: newClient.isVideoEnabled,
            isScreenshareEnabled: newClient.streams.length > 1,
            deviceId: newClient.deviceId,
            isPendingToLeave: false,
            clientId: newClient.id,
        });
    }

    _wasClientSendingMedia(clientId) {
        const client = this._clients.get(clientId);

        if (!client) {
            throw new Error(`Client ${clientId} not found in ReconnectManager state`);
        }

        return client.isAudioEnabled || client.isVideoEnabled || client.isScreenshareEnabled;
    }

    _getPendingClientByDeviceId(deviceId) {
        return Array.from(this._clients.values()).find((c) => {
            return c.deviceId === deviceId && c.isPendingToLeave;
        });
    }
}
