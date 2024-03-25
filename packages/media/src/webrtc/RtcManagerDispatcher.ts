import P2pRtcManager from "./P2pRtcManager";
import { PROTOCOL_RESPONSES } from "../model/protocol";
import * as CONNECTION_STATUS from "../model/connectionStatusConstants";
import VegaRtcManager from "./VegaRtcManager";
import { ServerSocket } from "src/utils";
import { RtcManager, RtcEvents } from "./types";

export default class RtcManagerDispatcher {
    emitter: { emit: <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => void };
    currentManager: RtcManager | null;

    constructor({
        emitter,
        serverSocket,
        webrtcProvider,
        features,
    }: {
        emitter: { emit: <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => void };
        serverSocket: ServerSocket;
        webrtcProvider: any;
        features: any;
    }) {
        this.emitter = emitter;
        this.currentManager = null;
        serverSocket.on(
            PROTOCOL_RESPONSES.ROOM_JOINED,
            ({ room, selfId, error, eventClaim }: { room: any; selfId: any; error: any; eventClaim: string }) => {
                if (error) return; // ignore error responses which lack room
                const config = {
                    selfId,
                    room,
                    emitter,
                    serverSocket,
                    webrtcProvider,
                    features,
                    eventClaim,
                    deviceHandlerFactory: features?.deviceHandlerFactory,
                };
                const isSfu = !!room.sfuServer;
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
                rtcManager.setupSocketListeners();
                emitter.emit(CONNECTION_STATUS.EVENTS.RTC_MANAGER_CREATED, { rtcManager });
                this.currentManager = rtcManager;
                serverSocket.setRtcManager(rtcManager);
            }
        );
    }

    stopRtcManager() {
        if (this.currentManager) {
            this.currentManager.disconnectAll();
            this.emitter.emit(CONNECTION_STATUS.EVENTS.RTC_MANAGER_DESTROYED);
        }
    }
}
