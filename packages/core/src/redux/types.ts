export type ClientView = {
    id: string;
    clientId: string;
    displayName: string;
    hasActivePresentation?: boolean;
    stream?: MediaStream | null;
    isLocalClient?: boolean;
    isPresentation?: boolean;
    isVideoEnabled?: boolean;
    isAudioEnabled?: boolean;
};
