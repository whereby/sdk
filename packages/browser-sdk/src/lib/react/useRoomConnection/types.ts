import { LocalMediaOptions, RoomJoinedSuccess } from "@whereby.com/core";

import { UseLocalMediaResult } from "../useLocalMedia/types";

export interface RoomConnectionOptions {
    displayName?: string; // Might not be needed at all
    localMediaOptions?: LocalMediaOptions;
    roomKey?: string;
    localMedia?: UseLocalMediaResult;
    externalId?: string;
}

export interface UseRoomConnectionOptions extends Omit<RoomConnectionOptions, "localMedia"> {
    localMedia?: UseLocalMediaResult;
}

export interface RoomConnectionActions {
    toggleLowDataMode: (enabled?: boolean) => void;
    toggleRaiseHand: (enabled?: boolean) => void;
    askToSpeak: (participantId: string) => void;
    askToTurnOnCamera: (participantId: string) => void;
    acceptWaitingParticipant: (participantId: string) => void;
    knock: () => void;
    cancelKnock: () => void;
    joinRoom: () => Promise<RoomJoinedSuccess>;
    leaveRoom: () => void;
    lockRoom: (locked: boolean) => void;
    muteParticipants: (clientIds: string[]) => void;
    turnOffParticipantCameras: (clientIds: string[]) => void;
    kickParticipant: (clientId: string) => void;
    endMeeting: (stayBehind?: boolean) => void;
    rejectWaitingParticipant: (participantId: string) => void;
    sendChatMessage: (text: string) => void;
    setDisplayName: (displayName: string) => void;
    startCloudRecording: () => void;
    startScreenshare: () => void;
    stopCloudRecording: () => void;
    stopScreenshare: () => void;
    toggleCamera: (enabled?: boolean) => void;
    toggleMicrophone: (enabled?: boolean) => void;
    spotlightParticipant: (clientId: string) => void;
    removeSpotlight: (clientId: string) => void;
    joinBreakoutGroup: (group: string) => void;
    joinBreakoutMainRoom: () => void;
    switchCameraEffect: (effectId: string) => Promise<void>;
    switchCameraEffectCustom: (imageUrl: string) => Promise<void>;
    clearCameraEffect: () => Promise<void>;
}
