import P2pRtcManager from "./P2pRtcManager";
import { PROTOCOL_RESPONSES } from "../model/protocol";
import * as CONNECTION_STATUS from "../model/connectionStatusConstants";
import VegaRtcManager from "./VegaRtcManager";
import { ServerSocket } from "../utils";
import { RtcManager, RtcEvents, RtcEventEmitter, WebRTCProvider, RtcFeatures, RoomState } from "./types";
import { DynamicRtcManager } from "./DynamicRtcManager";

export interface RtcManagerConfig {
    selfId: string;
    room: RoomState;
    emitter: RtcEventEmitter;
    serverSocket: ServerSocket;
    webrtcProvider: WebRTCProvider;
    features: RtcFeatures;
    eventClaim?: string;
}
export default class RtcManagerDispatcher {
    emitter: { emit: <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => void };
    currentManager: RtcManager | null;

    constructor({
        emitter,
        serverSocket,
        webrtcProvider,
        features,
    }: {
        emitter: RtcEventEmitter;
        serverSocket: ServerSocket;
        webrtcProvider: WebRTCProvider;
        features: RtcFeatures;
    }) {
        this.emitter = emitter;
        this.currentManager = null;
        serverSocket.on(
            PROTOCOL_RESPONSES.ROOM_JOINED,
            ({
                room,
                selfId,
                error,
                eventClaim,
            }: {
                room: RoomState;
                selfId: string;
                error: unknown;
                eventClaim: string;
            }) => {
                if (error) return; // ignore error responses which lack room
                const config = {
                    selfId,
                    room,
                    emitter,
                    serverSocket,
                    webrtcProvider,
                    features,
                    eventClaim,
                };
                const isSfu = !!room.sfuServer;
                roomMode = isSfu ? "group" : "normal";
                const rtcManager = (() => {
                    switch (room.mode) {
                        case "normal":
                            return new P2pRtcManager(config);
                        case "group":
                            return new VegaRtcManager(config);
                        case "dynamic":
                            return new DynamicRtcManager(config);
                    }
                })();
                // @ts-expect-error
                document.rtcManager = rtcManager;

                if (this.currentManager) {
                    if (this.currentManager.isInitializedWith({ selfId, roomName: room.name, isSfu })) {
                        if (this.currentManager.setEventClaim && eventClaim) {
                            this.currentManager.setEventClaim(eventClaim);
                        }
                        return;
                    }
                    this.currentManager.disconnectAll();
                    emitter.emit(CONNECTION_STATUS.EVENTS.RTC_MANAGER_DESTROYED);
                }

                rtcManager.rtcStatsReconnect();
                rtcManager.setupSocketListeners();
                emitter.emit(CONNECTION_STATUS.EVENTS.RTC_MANAGER_CREATED, { rtcManager });
                this.currentManager = rtcManager;
                serverSocket.setRtcManager(rtcManager);
            },
        );
    }

    stopRtcManager() {
        if (this.currentManager) {
            this.currentManager.disconnectAll();
            this.emitter.emit(CONNECTION_STATUS.EVENTS.RTC_MANAGER_DESTROYED);
        }
    }
}

let roomMode = "";
export const getRoomMode = () => {
    return roomMode;
};
