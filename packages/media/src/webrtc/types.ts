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
    replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack): void;
    removeStream(streamId: string, _stream: MediaStream, requestedByClientId: string | null): void;
    shouldAcceptStreamsFromBothSides?: () => boolean;
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

export type GetUpdatedDevicesResult = {
    addedDevices: {
        audioinput?: { deviceId: string; label: string; kind: string };
        videoinput?: { deviceId: string; label: string; kind: string };
        audiooutput?: { deviceId: string; label: string; kind: string };
    };
    changedDevices: {
        audioinput?: { deviceId: string; label: string; kind: string };
        videoinput?: { deviceId: string; label: string; kind: string };
        audiooutput?: { deviceId: string; label: string; kind: string };
    };
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
