import { P2pRtcManager } from ".";
import { PROTOCOL_EVENTS, PROTOCOL_RESPONSES } from "../model";
import { RtcManagerConfig } from "./RtcManagerDispatcher";
import VegaRtcManager from "./VegaRtcManager";
import { RtcEventEmitter, RtcEventNames, RtcEvents, RtcManager, RtcStreamAddedPayload } from "./types";
import * as CONNECTION_STATUS from "../model/connectionStatusConstants";
import { v4 as uuid } from "uuid";

export interface DynamicRtcManager extends RtcManager {}

export class DynamicRtcManager {
    currentRtcManager: "p2p" | "vega" = "p2p";
    p2pRtcManager: P2pRtcManager;
    vegaRtcManager: VegaRtcManager;
    createdWithConfig: RtcManagerConfig;
    roomEmitter: RtcEventEmitter;
    vegaEmitter: RtcEventEmitter;
    p2pEmitter: RtcEventEmitter;
    proxyStreamMap: Record<string, MediaStream>;
    vegaStreamMap: Record<string, MediaStream>;
    p2pStreamMap: Record<string, MediaStream>;
    clientIdStreamIdMap: Record<string, string>;

    constructor(config: RtcManagerConfig) {
        config.emitter;
        this.createdWithConfig = config;
        this.roomEmitter = config.emitter;
        this.proxyStreamMap = {};
        this.vegaStreamMap = {};
        this.p2pStreamMap = {};
        this.clientIdStreamIdMap = {};
        this.vegaEmitter = {
            emit: this.onVegaEvent,
        };
        this.p2pEmitter = {
            emit: this.onP2pEvent,
        };

        this.vegaRtcManager = new VegaRtcManager({ ...this.createdWithConfig, emitter: this.vegaEmitter });
        this.p2pRtcManager = new P2pRtcManager({ ...config, emitter: this.p2pEmitter });
        this.roomEmitter = config.emitter;
    }

    // implement all RtcManager functions

    acceptNewStream({
        streamId,
        clientId,
        shouldAddLocalVideo,
    }: {
        streamId: string;
        clientId: string;
        shouldAddLocalVideo?: boolean;
    }) {
        console.log("TRACE DynamicRtcManager.acceptNewStream", {
            streamId,
            clientId,
        });
        this.vegaRtcManager.acceptNewStream({ streamId, clientId });
        this.p2pRtcManager.acceptNewStream({ streamId, clientId, shouldAddLocalVideo });

        this.proxyStreamMap[clientId] = new MediaStream();
        this.clientIdStreamIdMap[clientId] = streamId;
    }

    onVegaEvent = <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => {
        console.log("trace onVegaEvent", eventName);
        switch (eventName) {
            case "stream_added": {
                console.log("TRACE DynamicRtcManager.onVegaEvent.stream_added", args);
                const { clientId, stream, streamId } = args as RtcStreamAddedPayload;
                this.vegaStreamMap[clientId] = stream;
                this.clientIdStreamIdMap[clientId] = streamId ?? this.clientIdStreamIdMap[clientId];

                if (this.currentRtcManager === "vega") {
                    const proxyStream = this.proxyStreamMap[clientId];

                    this.addTracksToProxy(proxyStream, stream);
                    this.roomEmitter.emit(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                        clientId,
                        stream: proxyStream,
                    });
                }
                return;
            }
            default: {
                console.log("trace vega event", eventName);
                if (this.currentRtcManager === "vega") {
                    this.roomEmitter.emit(eventName, args);
                }
            }
        }
    };
    onP2pEvent = <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => {
        console.log("trace onP2pEvent", eventName);
        switch (eventName) {
            case "stream_added":
                {
                    const { clientId, stream, streamId } = args as RtcStreamAddedPayload;
                    console.log("trace DynamicRtcManager.onP2pEvent.stream_added", { clientId });
                    this.p2pStreamMap[clientId] = stream;
                    this.clientIdStreamIdMap[clientId] = streamId ?? this.clientIdStreamIdMap[clientId];

                    if (this.currentRtcManager === "p2p") {
                        let proxyStream = this.proxyStreamMap[clientId];
                        if (!proxyStream) {
                            proxyStream = new MediaStream();
                            this.proxyStreamMap[clientId] = proxyStream;
                        }
                        this.addTracksToProxy(proxyStream, stream);
                        this.roomEmitter.emit(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                            clientId,
                            stream: proxyStream,
                        });
                    }
                    return;
                }
                console.log("trace p2p event", eventName);
            default: {
                if (this.currentRtcManager === "p2p") {
                    this.roomEmitter.emit(eventName, args);
                }
            }
        }
    };
    private addTracksToProxy(proxyStream: MediaStream, newStream: MediaStream) {
        console.log("TRACE DynamicRtcManager.addTracksToProxy", {
            proxyStreamId: proxyStream.id,
            newStreamId: newStream.id,
        });
        proxyStream.getTracks().forEach((track) => {
            proxyStream.removeTrack(track);
        });
        newStream.getTracks().forEach((track) => {
            proxyStream.addTrack(track);
        });
    }

    addNewStream(streamId: string, stream: MediaStream, isAudioEnabled: boolean, isVideoEnabled: boolean) {
        console.log("TRACE DynamicRtcManager.addNewStream", {
            streamId,
        });
        const isVega = this.currentRtcManager === "vega";
        this.vegaRtcManager.addNewStream(streamId, stream, isAudioEnabled, isVideoEnabled);
        this.p2pRtcManager.addNewStream(streamId, stream, isAudioEnabled, isVideoEnabled);
    }

    async swapToVega() {
        this.currentRtcManager = "vega";
        await new Promise<void>((resolve) => {
            Object.keys(this.p2pStreamMap).forEach((clientId) => {
                const vegaStream = this.vegaStreamMap[clientId];
                if (!vegaStream) {
                    console.log("trace, swapToVega, no vegaStream", { clientId });
                }
                const proxyStream = this.proxyStreamMap[clientId];
                this.addTracksToProxy(proxyStream, vegaStream);
            });
            resolve();
        });
        this.p2pRtcManager.disconnectAll();
        this.p2pStreamMap = {};
    }

    rtcStatsReconnect(...args: Parameters<RtcManager["rtcStatsReconnect"]>) {
        this.p2pRtcManager.rtcStatsReconnect(...args);
        this.vegaRtcManager.rtcStatsReconnect(...args);
    }
    rtcStatsDisconnect(...args: Parameters<RtcManager["rtcStatsDisconnect"]>) {
        this.p2pRtcManager.rtcStatsDisconnect(...args);
        this.vegaRtcManager.rtcStatsDisconnect(...args);
    }
    disconnect(...args: Parameters<RtcManager["disconnect"]>) {
        // @ts-expect-error
        this.p2pRtcManager.disconnect(...args);
        this.vegaRtcManager.disconnect(...args);
    }
    disconnectAll(...args: Parameters<RtcManager["disconnectAll"]>) {
        this.p2pRtcManager.disconnectAll(...args);
        this.vegaRtcManager.disconnectAll(...args);
    }
    replaceTrack(...args: Parameters<RtcManager["replaceTrack"]>) {
        this.p2pRtcManager.replaceTrack(...args);
        this.vegaRtcManager.replaceTrack(...args);
    }
    removeStream(...args: Parameters<RtcManager["removeStream"]>) {
        this.p2pRtcManager.removeStream(...args);
        // @ts-expect-error
        this.vegaRtcManager.removeStream(...args);
    }
    shouldAcceptStreamsFromBothSides(...args: Parameters<RtcManager["disconnectAll"]>) {
        return this.vegaRtcManager.shouldAcceptStreamsFromBothSides(...args) ?? false;
    }
    updateStreamResolution(...args: Parameters<RtcManager["updateStreamResolution"]>) {
        // @ts-expect-error
        this.p2pRtcManager.updateStreamResolution(...args);
        this.vegaRtcManager.updateStreamResolution(...args);
    }
    sendStatsCustomEvent(...args: Parameters<RtcManager["sendStatsCustomEvent"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager.sendStatsCustomEvent(...args);
        } else {
            this.vegaRtcManager.sendStatsCustomEvent(...args);
        }
    }
    isInitializedWith(...args: Parameters<RtcManager["isInitializedWith"]>) {
        return this.vegaRtcManager.isInitializedWith(...args) ?? this.p2pRtcManager.isInitializedWith(...args);
    }
    setEventClaim(...args: any[]) {
        // @ts-expect-error
        this.vegaRtcManager.setEventClaim(...args);
    }
    hasClient(...args: Parameters<RtcManager["hasClient"]>) {
        if (this.currentRtcManager === "p2p") {
            return this.p2pRtcManager.hasClient(...args);
        } else {
            return this.vegaRtcManager.hasClient(...args);
        }
    }
    setupSocketListeners(...args: Parameters<RtcManager["setupSocketListeners"]>) {
        this.p2pRtcManager.setupSocketListeners(...args);
        this.vegaRtcManager.setupSocketListeners(...args);
    }
    sendAudioMutedStats() {}
    sendVideoMutedStats() {}
    supportsScreenShareAudio() {
        if (this.currentRtcManager === "p2p") {
            return this.p2pRtcManager.supportsScreenShareAudio();
        } else {
            return this.vegaRtcManager.supportsScreenShareAudio();
        }
    }
    stopOrResumeVideo(...args: Parameters<RtcManager["stopOrResumeVideo"]>) {
        this.p2pRtcManager.stopOrResumeVideo(...args);
        this.vegaRtcManager.stopOrResumeVideo(...args);
    }
    stopOrResumeAudio(...args: Parameters<RtcManager["stopOrResumeAudio"]>) {
        this.p2pRtcManager.stopOrResumeAudio();
        this.vegaRtcManager.stopOrResumeAudio(...args);
    }
    setRoomSessionId(...args: Parameters<RtcManager["setRoomSessionId"]>) {
        this.p2pRtcManager.setRoomSessionId(...args);
        this.vegaRtcManager.setRoomSessionId(...args);
    }
}
