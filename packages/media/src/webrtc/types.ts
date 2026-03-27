import { SignalRoom, ServerSocket } from "../utils";

export enum RtcEventNames {
    rtc_manager_created = "rtc_manager_created",
    stream_added = "stream_added",
}

export type RtcEventEmitter = { emit: <K extends keyof RtcEvents>(eventName: K, args?: RtcEvents[K]) => void };

export interface RtcManagerOptions {
    selfId: string;
    room: SignalRoom;
    emitter: RtcEventEmitter;
    serverSocket: ServerSocket;
    webrtcProvider: WebRTCProvider;
    features: any;
}

export interface VegaRtcManagerOptions extends RtcManagerOptions {
    eventClaim: string;
}

export interface RtcManager {
    acceptNewStream: ({ clientId, streamId }: { clientId: string; streamId: string }) => void;
    addCameraStream(stream: MediaStream, options?: AddCameraStreamOptions): void;
    addScreenshareStream(stream: MediaStream): void;
    removeScreenshareStream(stream: MediaStream, options?: RemoveScreenshareStreamOptions): void;
    disconnect(streamId: string, eventClaim?: string): void;
    disconnectAll(): void;
    rtcStatsDisconnect(): void;
    rtcStatsReconnect(): void;
    replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack): void;
    shouldAcceptStreamsFromBothSides: () => boolean;
    updateStreamResolution(streamId: string, ignored: null, resolution: { width: number; height: number }): void;
    sendStatsCustomEvent(eventName: string, data: unknown): void;
    isInitializedWith({ selfId, roomName, isSfu }: { selfId: string; roomName: string; isSfu: boolean }): boolean;
    setEventClaim?(eventClaim: string): void;
    hasClient(clientId: string): boolean;
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

export type RtcEvents = {
    client_connection_status_changed: RtcClientConnectionStatusChangedPayload;
    stream_added: RtcStreamAddedPayload;
    rtc_manager_created: RtcManagerCreatedPayload;
    rtc_manager_destroyed: void;
    local_stream_track_added: RtcLocalStreamTrackAddedPayload;
    local_stream_track_removed: RtcLocalStreamTrackRemovedPayload;
    remote_stream_track_added: void;
    remote_stream_track_removed: void;
};

export type SignalRTCSessionDescription = {
    sdp?: string;
    sdpU?: string;
    type: RTCSdpType;
    isInitialOffer?: boolean;
};

export type SignalSDPMessage = {
    clientId: string;
    message: SignalRTCSessionDescription;
};

export type SignalIceCandidateMessage = {
    clientId: string;
    message: RTCIceCandidate;
};

export type SignalReadyToReceiveOfferMessage = {
    clientId: string;
};

export type SignalIceEndOfCandidatesMessage = {
    clientId: string;
};

export interface WebRTCProvider {
    getMediaOptions: () => GetConstraintsOptions;
}

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

export type SignalIceServer = {
    credential: string;
    url: string;
    urls: string[];
    username: string;
};

export type SignalTurnServer = {
    credential: string;
    urls: string | string[];
    username: string;
};

export type SignalMediaServerConfig = {
    error?: any;
    mediaserverConfigTtlSeconds: number;
    iceServers: SignalIceServer[];
    turnServers: SignalTurnServer[];
    sfuServer?: SignalSFUServer;
};

export type SignalSFUServer = {
    url: string;
    fallbackUrl?: string;
    fallbackServers?: any[];
};

export interface AddCameraStreamOptions {
    audioPaused?: boolean;
    videoPaused?: boolean;
    beforeEffectTracks?: MediaStreamTrack[];
}

export interface RemoveScreenshareStreamOptions {
    requestedByClientId?: string;
}
