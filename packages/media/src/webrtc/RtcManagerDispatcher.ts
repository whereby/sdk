import P2pRtcManager from "./P2pRtcManager";
import { PROTOCOL_RESPONSES } from "../model/protocol";
import * as CONNECTION_STATUS from "../model/connectionStatusConstants";
import VegaRtcManager from "./VegaRtcManager";
import { RoomJoinedErrors, RoomJoinedEvent, RoomJoinedSuccess, ServerSocket } from "../utils";
import { RtcManager, RtcEvents, RtcEventEmitter } from "./types";

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
        webrtcProvider: any;
        features: any;
    }) {
        this.emitter = emitter;
        this.currentManager = null;
        serverSocket.on(PROTOCOL_RESPONSES.ROOM_JOINED, (payload: RoomJoinedEvent) => {
            if ("error" in payload) return; // ignore error responses which lack room

            const { room, selfId, eventClaim } = payload;
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
            let rtcManager = null;
            if (isSfu) {
                rtcManager = new VegaRtcManager(config);
            } else {
                rtcManager = new P2pRtcManager(config);
            }
            rtcManager.rtcStatsConnect();
            rtcManager.setupSocketListeners();
            emitter.emit(CONNECTION_STATUS.EVENTS.RTC_MANAGER_CREATED, { rtcManager });
            this.currentManager = rtcManager;
            serverSocket.setRtcManager(rtcManager);
        });
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
