export type ClientView = {
    id: string;
    clientId: string;
    displayName: string;
    hasActivePresentation?: boolean;
    stream?: (MediaStream & { outboundId?: string; inboundId?: string }) | null;
    isLocalClient?: boolean;
    isPresentation?: boolean;
    isVideoEnabled?: boolean;
    isAudioEnabled?: boolean;
    breakoutGroup?: string | null;
    breakoutGroupAssigned?: string;
};
