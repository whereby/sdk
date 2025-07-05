import { P2pRtcManager } from ".";
import { PROTOCOL_EVENTS } from "../model";
import { RtcManagerConfig } from "./RtcManagerDispatcher";
import VegaRtcManager from "./VegaRtcManager";
import {
    MediaStreamWhichMayHaveDirectionalIds,
    RtcEventEmitter,
    RtcEvents,
    RtcManager,
    RtcStreamAddedPayload,
} from "./types";
import * as CONNECTION_STATUS from "../model/connectionStatusConstants";
import { ServerSocket } from "../utils";
import Logger from "../utils/Logger";
const logger = new Logger();

interface ClientStreams {
    pwa: Record<string, MediaStreamWhichMayHaveDirectionalIds>;
    vega: Record<string, MediaStreamWhichMayHaveDirectionalIds>;
    p2p: Record<string, MediaStreamWhichMayHaveDirectionalIds>;
    webcamP2pStreamId?: string;
}

class ClientStreamMap {
    map: Record<string, ClientStreams> = {};

    hasClientVegaStream({ clientId, streamId }: { clientId: string; streamId: string }) {
        const clientMap = this.map[clientId];
        if (!clientMap) {
            return false;
        }

        return !!clientMap.vega[streamId];
    }
    hasClientP2pStream({ clientId, streamId }: { clientId: string; streamId: string }) {
        const clientMap = this.map[clientId];
        if (!clientMap) {
            return false;
        }

        return !!clientMap.p2p[streamId];
    }
    hasClientPwaStream({ clientId, streamId }: { clientId: string; streamId: string }) {
        const clientMap = this.map[clientId];
        if (!clientMap) {
            return false;
        }

        return !!clientMap.pwa[streamId];
    }
    addPwaStream({
        clientId,
        streamId,
        stream,
    }: {
        clientId: string;
        streamId: string;
        stream: MediaStreamWhichMayHaveDirectionalIds;
    }) {
        if (!this.map[clientId]) {
            this.map[clientId] = { pwa: {}, vega: {}, p2p: {} };
        }
        this.map[clientId].pwa[streamId] = stream;
    }
    addVegaStream({
        clientId,
        streamId,
        stream,
    }: {
        clientId: string;
        streamId: string;
        stream: MediaStreamWhichMayHaveDirectionalIds;
    }) {
        if (!this.map[clientId]) {
            this.map[clientId] = { pwa: {}, vega: {}, p2p: {} };
        }
        this.map[clientId].vega[streamId] = stream;
    }
    addP2pStream({
        clientId,
        streamId,
        stream,
    }: {
        clientId: string;
        streamId: string;
        stream: MediaStreamWhichMayHaveDirectionalIds;
    }) {
        if (!this.map[clientId]) {
            this.map[clientId] = { pwa: {}, vega: {}, p2p: {} };
        }
        if (!this.map[clientId].webcamP2pStreamId) {
            this.map[clientId].webcamP2pStreamId = streamId;
        }

        this.map[clientId].p2p[streamId] = stream;
    }
    getOrCreatePwaStream({ clientId, streamId }: { clientId: string; streamId: string }) {
        let clientMap = this.map[clientId];
        if (!clientMap) {
            clientMap = { pwa: {}, vega: {}, p2p: {} };
            this.map[clientId] = clientMap;
        }
        let stream = clientMap.pwa[streamId];
        if (!stream) {
            stream = new MediaStream();
            this.map[clientId].pwa[streamId] = stream;
        }
        return stream;
    }
    getPwaStream({ clientId, streamId }: { clientId: string; streamId: string }) {
        const stream = this.map[clientId]?.pwa[streamId];
        if (!stream) {
            throw new Error(`No PWA stream found for clientId: ${clientId} and streamId: ${streamId}`);
        }
        return stream;
    }
    getVegaStream({ clientId, streamId }: { clientId: string; streamId: string }) {
        const stream = this.map[clientId]?.vega[streamId];
        if (!stream) {
            return null;
        }
        return stream;
    }
    getVegaStreamMissingFromP2p({ clientId }: { clientId: string }) {
        const p2pMap = this.map[clientId]?.p2p;
        const vegaMap = this.map[clientId]?.vega;
        if (!p2pMap) {
            throw new Error(`Somehow missing p2p map for ${clientId}`);
        }
        if (!vegaMap) {
            throw new Error(`Somehow missing vega map for ${clientId}`);
        }

        const missingIds = Object.keys(vegaMap).filter((streamId) => {
            return !p2pMap[streamId];
        });
        if (missingIds.length !== 1) {
            logger.warn("Could not find missing vega stream", this.map[clientId], missingIds);
            return null;
        }
        const streamId = missingIds[0]!;

        return vegaMap[streamId];
    }
    getP2pStream({ clientId, streamId }: { clientId: string; streamId: string }) {
        const stream = this.map[clientId]?.p2p[streamId];
        if (!stream) {
            logger.warn("ClientStreamMap.getP2pStream", this.map[clientId]);
            throw new Error(`No P2p stream found for clientId: ${clientId} and streamId: ${streamId}`);
        }
        return stream;
    }
    getP2pStreamIdPairs() {
        return Object.keys(this.map)
            .map((clientId) => {
                const clientMap = this.map[clientId];
                if (!clientMap) {
                    throw new Error(`No clientMap found for clientId: ${clientId}`);
                }
                return Object.keys(clientMap.p2p).map<{ clientId: string; streamId: string }>((streamId) => ({
                    clientId,
                    streamId,
                }));
            })
            .flat();
    }
    clearP2pStreams() {
        Object.keys(this.map).forEach((clientId) => {
            this.map[clientId].p2p = {};
        });
    }
}

export class DynamicRtcManager {
    currentRtcManager: "p2p" | "vega";
    p2pRtcManager?: P2pRtcManager;
    vegaRtcManager: VegaRtcManager;
    createdWithConfig: RtcManagerConfig;
    pwaEmitter: RtcEventEmitter;
    serverSocket: ServerSocket;
    vegaEmitter: RtcEventEmitter;
    p2pEmitter: RtcEventEmitter;
    clientStreamMap = new ClientStreamMap();

    constructor(config: RtcManagerConfig) {
        this.currentRtcManager = config.room.dynamicRoomMode ?? "p2p";
        this.createdWithConfig = config;

        this.serverSocket = config.serverSocket;
        this.pwaEmitter = config.emitter;
        this.vegaEmitter = {
            emit: this.onVegaEvent,
        };
        this.p2pEmitter = {
            emit: this.onP2pEvent,
        };

        this.vegaRtcManager = new VegaRtcManager({
            ...this.createdWithConfig,
            emitter: this.vegaEmitter,
            globalPause: this.currentRtcManager === "p2p",
        });
        this.vegaRtcManager._emitToSignal = (...args) => {
            if (this.currentRtcManager === "vega") {
                this.serverSocket.emit(...args);
            }
        };
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager = new P2pRtcManager({ ...config, emitter: this.p2pEmitter });
            this.p2pRtcManager._emitServerEvent = (...args) => {
                if (this.currentRtcManager === "p2p") {
                    this.serverSocket.emit(...args);
                }
            };
        }
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
        if (!this.clientStreamMap.hasClientVegaStream({ clientId, streamId })) {
            this.vegaRtcManager.acceptNewStream({ streamId, clientId });
        }

        if (!this.clientStreamMap.hasClientP2pStream({ clientId, streamId }) && this.currentRtcManager === "p2p") {
            // PWA calls `rtcManager.shouldAcceptStreamsFromBothSides.?()` before calling `rtcManager.acceptNewStream`
            // we need this to return true so we can call this.vegaRtcManager.acceptNewStream, so we only call
            // this.p2pRtcManager.acceptNewStream when we haven't already received this stream after emitting `ready_to_receive_offer`
            this.p2pRtcManager?.acceptNewStream({ streamId, clientId, shouldAddLocalVideo });
        }
    }

    onVegaEvent = <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => {
        switch (eventName) {
            case "stream_added": {
                const { clientId, stream, streamId, streamType } = args as RtcStreamAddedPayload;
                if (!streamId) {
                    throw new Error(`Well, there's no stream id adding vega stream !?!, clientId: ${clientId}`);
                }

                this.clientStreamMap.addVegaStream({ clientId, stream, streamId });

                if (this.currentRtcManager === "vega") {
                    const pwaStream = this.clientStreamMap.getOrCreatePwaStream({
                        clientId,
                        streamId,
                    });

                    this.swapTracksToPwa(pwaStream, stream);
                    this.pwaEmitter.emit(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                        clientId,
                        stream: pwaStream,
                        streamId,
                        streamType,
                    });
                }
                return;
            }
            default: {
                if (this.currentRtcManager === "vega") {
                    this.pwaEmitter.emit(eventName, args);
                }
            }
        }
    };
    onP2pEvent = <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => {
        switch (eventName) {
            case "stream_added": {
                const { clientId, stream } = args as RtcStreamAddedPayload;
                let { streamId } = args as RtcStreamAddedPayload;

                if (!streamId) {
                    // P2pRtcManager doesn't emit streamIds, clientId is the streamId for the webcam, so this will differentiate between presentation streams and webcam streams
                    streamId = stream.id;
                    console.log("trace setting streamId to stream.id", { stream });
                }

                this.clientStreamMap.addP2pStream({ clientId, stream, streamId });

                if (this.currentRtcManager === "p2p") {
                    const pwaStream = this.clientStreamMap.getOrCreatePwaStream({
                        clientId,
                        streamId,
                    });
                    const isWebcam = this.clientStreamMap.map[clientId].webcamP2pStreamId === streamId;
                    this.swapTracksToPwa(pwaStream, stream);
                    this.pwaEmitter.emit(CONNECTION_STATUS.EVENTS.STREAM_ADDED, {
                        clientId,
                        stream: pwaStream,
                        streamType: isWebcam ? "webcam" : "screenshare",
                    });
                }
                return;
            }
            default: {
                if (this.currentRtcManager === "p2p") {
                    this.pwaEmitter.emit(eventName, args);
                }
            }
        }
    };
    private swapTracksToPwa(
        pwaStream: MediaStreamWhichMayHaveDirectionalIds,
        newStream: MediaStreamWhichMayHaveDirectionalIds,
    ) {
        pwaStream.getTracks().forEach((track) => {
            pwaStream.removeTrack(track);
        });
        newStream.getTracks().forEach((track) => {
            pwaStream.addTrack(track);
        });
        pwaStream.inboundId = newStream.inboundId;
        pwaStream.outboundId = newStream.outboundId;
    }

    addNewStream(
        streamId: string,
        stream: MediaStreamWhichMayHaveDirectionalIds,
        isAudioEnabled: boolean,
        isVideoEnabled: boolean,
    ) {
        // const isVega = this.currentRtcManager === "vega";
        this.vegaRtcManager.addNewStream(streamId, stream, false && isAudioEnabled, false && isVideoEnabled);
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.addNewStream(streamId, stream, isAudioEnabled, isVideoEnabled);
        }
    }

    async swapToVega() {
        if (this.currentRtcManager === "vega") {
            return;
        }
        this.currentRtcManager = "vega";
        this.vegaRtcManager.globalResume();
        await new Promise<void>((resolve) => {
            this.clientStreamMap.getP2pStreamIdPairs().forEach(({ clientId, streamId }) => {
                const vegaStream: MediaStreamWhichMayHaveDirectionalIds | null =
                    this.clientStreamMap.getVegaStream({ clientId, streamId }) ??
                    this.clientStreamMap.getVegaStreamMissingFromP2p({ clientId });
                if (!vegaStream) {
                    // get whatever vega stream has an ID that doesn't exist in p2p streams
                    return;
                }

                const pwaStream = this.clientStreamMap.getPwaStream({ clientId, streamId });
                this.swapTracksToPwa(pwaStream, vegaStream);
            });
            resolve();
        });
        this.p2pRtcManager?.disconnectAll();
        this.clientStreamMap.clearP2pStreams();
        this.pwaEmitter.emit("rtc_manager_swapped", { currentRtcManager: this.currentRtcManager });
    }

    rtcStatsReconnect(...args: Parameters<RtcManager["rtcStatsReconnect"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.rtcStatsReconnect(...args);
        }
        this.vegaRtcManager.rtcStatsReconnect(...args);
    }
    rtcStatsDisconnect(...args: Parameters<RtcManager["rtcStatsDisconnect"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.rtcStatsDisconnect(...args);
        }
        this.vegaRtcManager.rtcStatsDisconnect(...args);
    }
    disconnect(...args: Parameters<RtcManager["disconnect"]>) {
        if (this.currentRtcManager === "p2p") {
            // @ts-expect-error
            this.p2pRtcManager?.disconnect(...args);
        }
        this.vegaRtcManager.disconnect(...args);
    }
    disconnectAll(...args: Parameters<RtcManager["disconnectAll"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.disconnectAll(...args);
        }
        this.vegaRtcManager.disconnectAll(...args);
    }
    replaceTrack(...args: Parameters<RtcManager["replaceTrack"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.replaceTrack(...args);
        }
        this.vegaRtcManager.replaceTrack(...args);
    }
    removeStream(...args: Parameters<RtcManager["removeStream"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.removeStream(...args);
        }
        // @ts-expect-error
        this.vegaRtcManager.removeStream(...args);
    }
    shouldAcceptStreamsFromBothSides(...args: Parameters<RtcManager["disconnectAll"]>) {
        if (this.currentRtcManager === "p2p") {
            // we want to receieve these to pass through to the vega manager, but we wont
            return true;
        } else {
            return this.vegaRtcManager.shouldAcceptStreamsFromBothSides(...args);
        }
    }
    updateStreamResolution(...args: Parameters<RtcManager["updateStreamResolution"]>) {
        if (this.currentRtcManager === "p2p") {
            // @ts-expect-error
            this.p2pRtcManager?.updateStreamResolution(...args);
        }
        this.vegaRtcManager.updateStreamResolution(...args);
    }
    sendStatsCustomEvent(...args: Parameters<RtcManager["sendStatsCustomEvent"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.sendStatsCustomEvent(...args);
        } else {
            this.vegaRtcManager.sendStatsCustomEvent(...args);
        }
    }
    isInitializedWith(...args: Parameters<RtcManager["isInitializedWith"]>) {
        if (this.currentRtcManager === "p2p") {
            return this.p2pRtcManager?.isInitializedWith(...args) ?? false;
        } else {
            return this.vegaRtcManager.isInitializedWith(...args);
        }
    }
    setEventClaim(...args: Parameters<VegaRtcManager["setEventClaim"]>) {
        this.vegaRtcManager.setEventClaim(...args);
    }
    hasClient(...args: Parameters<RtcManager["hasClient"]>) {
        if (this.currentRtcManager === "p2p") {
            return this.p2pRtcManager?.hasClient(...args) ?? false;
        } else {
            return this.vegaRtcManager.hasClient(...args);
        }
    }
    setupSocketListeners(...args: Parameters<RtcManager["setupSocketListeners"]>) {
        this.serverSocket.on(
            PROTOCOL_EVENTS.DYNAMIC_ROOM_MODE_CHANGED,
            ({ dynamicRoomMode }: { dynamicRoomMode: DynamicRtcManager["currentRtcManager"] }) => {
                if (dynamicRoomMode !== this.currentRtcManager && dynamicRoomMode === "vega") {
                    this.swapToVega();
                }
            },
        );
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.setupSocketListeners(...args);
        }
        this.vegaRtcManager.setupSocketListeners(...args);
    }
    sendAudioMutedStats() {}
    sendVideoMutedStats() {}
    supportsScreenShareAudio() {
        if (this.currentRtcManager === "p2p") {
            return this.p2pRtcManager?.supportsScreenShareAudio();
        } else {
            return this.vegaRtcManager.supportsScreenShareAudio();
        }
    }
    stopOrResumeVideo(...args: Parameters<RtcManager["stopOrResumeVideo"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.stopOrResumeVideo(...args);
        }

        this.vegaRtcManager.stopOrResumeVideo(...args);
    }
    stopOrResumeAudio(...args: Parameters<RtcManager["stopOrResumeAudio"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.stopOrResumeAudio();
        }
        this.vegaRtcManager.stopOrResumeAudio(...args);
    }
    setRoomSessionId(...args: Parameters<RtcManager["setRoomSessionId"]>) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.setRoomSessionId(...args);
        }
        this.vegaRtcManager.setRoomSessionId(...args);
    }
    get peerConnections() {
        return this.p2pRtcManager?.peerConnections ?? {};
    }
    setRemoteScreenshareVideoTrackIds(trackIds = []) {
        if (this.currentRtcManager === "p2p") {
            this.p2pRtcManager?.setRemoteScreenshareVideoTrackIds(trackIds);
        }
        // @ts-expect-error unexpected argument
        this.vegaRtcManager.setRemoteScreenshareVideoTrackIds(trackIds);
    }
}
