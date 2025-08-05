/*
 * Types shared between the different stats, issues, and metrics modules within this directory
 */
export interface MediaStreamTrackWithDenoiserContext extends MediaStreamTrack {
    _denoiserCtx?: AudioContext;
}

export interface StatsClient {
    id: string;
    clientId: string;
    isLocalClient: boolean;
    isAudioOnlyModeEnabled: boolean;
    audio: {
        enabled: boolean;
        track?: MediaStreamTrackWithDenoiserContext;
    };
    video: {
        enabled: boolean;
        track?: MediaStreamTrack;
    };
    isPresentation: boolean;
}

export type PressureRecord = {
    source: string;
    state: string;
    time: number;
};

export interface TrackStats {
    startTime: number;
    updated: number;
    ssrcs: Record<number, SsrcStats>;
}

export interface ViewStats {
    startTime?: number;
    updated?: number;
    pressure?: PressureRecord | null;
    candidatePairs?: any;
    tracks: Record<string, TrackStats>;
}

export interface SsrcStats {
    startTime: number;
    updated: number;
    pcIndex: number;
    direction?: string;
    bitrate?: number;
    fractionLost?: number;
    height?: number;
    lossRatio?: number;
    pliRate?: number;
    fps?: number;
    audioLevel?: number;
    audioConcealment?: number;
    audioDeceleration?: number;
    audioAcceleration?: number;
    sourceHeight?: number;
    jitter?: number;
    roundTripTime?: number;
    codec?: string;
    byteCount?: number;
    kind?: string;
    ssrc?: number;
    mid?: number;
    rid?: string;
    nackCount?: number;
    nackRate?: number;
    packetCount?: number;
    packetRate?: number;
    headerByteCount?: number;
    mediaRatio?: number;
    sendDelay?: number;
    retransRatio?: number;
    width?: number;
    qualityLimitationReason?: string;
    pliCount?: number;
    firCount?: number;
    firRate?: number;
    kfCount?: number;
    kfRate?: number;
    frameCount?: number;
    qpf?: number;
    encodeTime?: number;
    sourceWidth?: number;
    sourceFps?: number;
}

