import { RoomMode, SignalClient, SignalKnocker } from "../utils";
import { HostListEntryOptionalDC } from "./VegaConnectionManager";
import { MEDIA_QUALITY } from "./VegaMediaQualityMonitor";

/*
    RTC
*/
export enum RtcEventNames {
    rtc_manager_created = "rtc_manager_created",
    stream_added = "stream_added",
}

export interface RtcManager {
    acceptNewStream: ({
        activeBreakout,
        clientId,
        shouldAddLocalVideo,
        streamId,
    }: {
        activeBreakout: boolean;
        clientId: string;
        shouldAddLocalVideo: boolean;
        streamId: string;
    }) => void;
    addNewStream(streamId: string, stream: MediaStream, isAudioEnabled: boolean, isVideoEnabled: boolean): void;
    disconnect(streamId: string, activeBreakout: boolean | null, eventClaim?: string): void;
    disconnectAll(): void;
    rtcStatsDisconnect(): void;
    rtcStatsReconnect(): void;
    replaceTrack(oldTrack: CustomMediaStreamTrack, newTrack: CustomMediaStreamTrack): void;
    removeStream(streamId: string, _stream: MediaStream, requestedByClientId: string | null): void;
    shouldAcceptStreamsFromBothSides?: () => boolean;
    updateStreamResolution(streamId: string, ignored: null, resolution: { width: number; height: number }): void;
    sendStatsCustomEvent(eventName: string, data: unknown): void;
    isInitializedWith({ selfId, roomName, isSfu }: { selfId: string; roomName: string; isSfu: boolean }): boolean;
    setEventClaim?(eventClaim: string): void;
    hasClient(clientId: string): boolean;
    setupSocketListeners(): void;
    stopOrResumeVideo(localStream: MediaStream, enable: boolean): void;
    stopOrResumeAudio(localStream: MediaStream, enable: boolean): void;
    setRoomSessionId(roomSessionId: string): void;
    setRemoteScreenshareVideoTrackIds(remoteScreenshareVideoTrackIds?: string[]): void;
}

export interface RtcManagerCreatedPayload {
    rtcManager: RtcManager;
}

export interface RtcStreamAddedPayload {
    clientId: string;
    stream: MediaStream;
    streamId: string | undefined;
    streamType: "webcam" | "screenshare" | undefined;
}

export interface RtcClientConnectionStatusChangedPayload {
    streamIds: string[];
    clientId: string;
    status: string;
    previous: string;
}

export interface RtcLocalStreamTrackAddedPayload {
    streamId: string;
    tracks: MediaStreamTrack[];
    screenShare: boolean;
}

export interface RtcLocalStreamTrackRemovedPayload {
    stream: MediaStream;
    track: MediaStreamTrack;
}

export interface RtcManagerSwappedPayload {
    currentRtcManager: DynamicRoomMode;
}

export type RtcEvents = {
    client_connection_status_changed: RtcClientConnectionStatusChangedPayload;
    stream_added: RtcStreamAddedPayload;
    rtc_manager_created: RtcManagerCreatedPayload;
    rtc_manager_destroyed: void;
    rtc_manager_swapped: RtcManagerSwappedPayload;
    local_stream_track_added: RtcLocalStreamTrackAddedPayload;
    local_stream_track_removed: RtcLocalStreamTrackRemovedPayload;
    remote_stream_track_added: void;
    remote_stream_track_removed: void;
    camera_not_working: void;
    connection_blocked_by_network: void;
    ice_ipv6_seen: {
        teredoSeen: boolean;
        sixtofourSeen: boolean;
    };
    ice_mdns_seen: void;
    ice_no_public_ip_gathered: void;
    ice_no_public_ip_gathered_3sec: void;
    ice_restart: void;
    microphone_not_working: void;
    microphone_stopped_working: void;
    camera_stopped_working: void;
    new_pc: void;
    sfu_connection_open: void;
    sfu_connection_closed: void;
    sfu_connection_info: void;
    colocation_speaker: void;
    dominant_speaker: void;
    pc_sld_failure: void;
    pc_on_answer_failure: void;
    pc_on_offer_failure: void;
    media_quality_changed: {
        clientId: string;
        kind: string;
        quality: typeof MEDIA_QUALITY;
    };
    pending_client_left: { clientId: string };
};

/*
    Media Devices
*/

export type GetMediaConstraintsOptions = {
    disableAEC: boolean;
    disableAGC: boolean;
    hd: boolean;
    lax: boolean;
    lowDataMode: boolean;
    preferredDeviceIds: {
        audioId?: boolean | string | null | { ideal?: string | null; exact?: string | null };
        videoId?: boolean | string | null | { ideal?: string | null; exact?: string | null };
    };
    resolution?: string;
    simulcast: boolean;
    widescreen: boolean;
    usingAspectRatio16x9: boolean;
};

export type GetConstraintsOptions = {
    devices: MediaDeviceInfo[];
    audioId?: boolean | string;
    videoId?: boolean | string;
    type?: "ideal" | "exact";
    options: Omit<GetMediaConstraintsOptions, "preferredDeviceIds">;
};

export type GetStreamOptions = {
    replaceStream?: MediaStream;
    fallback?: boolean;
};

export type GetStreamResult = {
    error?: unknown;
    replacedTracks?: MediaStreamTrack[];
    stream: MediaStream;
};

export type UpdatedDeviceInfo = {
    deviceId?: string | null;
    kind?: MediaDeviceKind;
    label?: string;
};

export type UpdatedDevicesInfo = {
    audioinput?: UpdatedDeviceInfo;
    videoinput?: UpdatedDeviceInfo;
    audiooutput?: UpdatedDeviceInfo;
};

export type GetUpdatedDevicesResult = {
    addedDevices: UpdatedDevicesInfo;
    changedDevices: UpdatedDevicesInfo;
    removedDevices: UpdatedDevicesInfo;
};

export type GetDeviceDataResult = {
    audio: {
        deviceId: string;
        label: string;
        kind: string;
    };
    video: {
        deviceId: string;
        label: string;
        kind: string;
    };
};

export interface CustomMediaStreamTrack extends MediaStreamTrack {
    effectTrack?: boolean;
}

export interface SFUServer {
    fqdn: string;
    ip: string;
    port: number;
    dc: string;
}

export interface SFUServerConfig {
    url: string;
    fallbackUrl: string;
    fallbackServers: SFUServer[];
    sfuProtocol: string;
}

export interface ICEServerConfig {
    url: string;
    urls: string[];
    username: string;
    credential: string;
}

export interface TurnServerConfig {
    urls: string[];
    username: string;
    credential: string;
}

export type RoomType = "free" | "premium";

type DynamicRoomMode = "vega" | "p2p";
export interface RoomState {
    clients: SignalClient[];
    name: string;
    organizationId: string;
    session: { id: string; createdAt: string } | null;
    sfuServer: SFUServerConfig | null;
    sfuServers?: HostListEntryOptionalDC[];
    iceServers: { iceServers: ICEServerConfig[] };
    turnServers: TurnServerConfig[];
    mediaserverConfigTtlSeconds: number;
    isClaimed: boolean;
    dynamicRoomMode?: DynamicRoomMode;
    mode: RoomMode;
}

export interface WebRTCProvider {
    getMediaConstraints: () => { audio: boolean; video: boolean };
    deferrable: (clientId: string) => boolean;
}

export type StoredMediaStream = MediaStream & { track?: MediaStreamTrack };

export interface MicAnalyserDebugger {
    onScoreUpdated: (data: unknown) => void;
    onConsumerScore: (clientId: string, score: number) => void;
}

export interface RtcEventEmitter {
    emit: <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => void;
}

export type VegaRtcFeatures = {
    increaseIncomingMediaBufferOn?: boolean;
    isNodeSdk?: boolean;
    lowBandwidth?: boolean;
    lowDataModeEnabled?: boolean;
    safari17HandlerOn?: boolean;
    sfuReconnectV2On?: boolean;
    sfuServerOverrideHost?: string;
    sfuServersOverride?: string;
    sfuVp9On?: boolean;
    simulcastScreenshareOn?: boolean;
    svcKeyScalabilityModeOn?: boolean;
    turnServerOverrideHost?: string;
    turnServersOn?: boolean;
    uncappedSingleRemoteVideoOn?: boolean;
    useOnlyTURN?: string;
    vp9On?: boolean;
    h264On?: boolean;
};

export interface P2PRtcFeatures {
    addCloudflareStunServers?: boolean;
    addGoogleStunServenrs?: boolean;
    adjustBitratesFromResolution?: boolean;
    bandwidth?: string;
    cleanSdpOn?: boolean;
    deprioritizeH264OnSafari?: boolean;
    highP2PBandwidth?: boolean;
    higherP2PBitrates?: boolean;
    increaseIncomingMediaBufferOn?: boolean;
    lowBandwidth?: boolean;
    p2pAv1On?: boolean;
    p2pVp9On?: boolean;
    preferP2pHardwareDecodingOn?: boolean;
    redOn?: boolean;
    rtpAbsCaptureTimeOn?: boolean;
    turnServerOverrideHost?: string;
    turnServersOn?: boolean;
    unlimitedBandwidthWhenUsingRelayP2POn?: boolean;
    useOnlyTURN?: string;
}

export type RtcFeatures = P2PRtcFeatures & VegaRtcFeatures;
