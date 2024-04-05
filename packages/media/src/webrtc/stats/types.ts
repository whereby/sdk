export interface StatsClient {
    id: string;
    clientId: string;
    isLocalClient: boolean;
    isAudioOnlyModeEnabled: boolean;
    audio: {
        enabled: boolean;
        track?: MediaStreamTrack;
    };
    video: {
        enabled: boolean;
        track?: MediaStreamTrack;
    };
    isPresentation: boolean;
}
