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
