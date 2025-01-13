import {
    ChatMessage as SignalChatMessage,
    LocalParticipant,
    RemoteParticipant,
    Screenshare,
    LocalMediaOptions,
    ConnectionStatus,
    NotificationsEventEmitter,
    ClientView,
} from "@whereby.com/core";

import { RoleName } from "@whereby.com/media";

import { UseLocalMediaResult } from "../useLocalMedia/types";

export type RemoteParticipantState = Omit<RemoteParticipant, "newJoiner" | "streams">;
export interface LocalParticipantState extends LocalParticipant {
    isScreenSharing: boolean;
    roleName: RoleName;
    clientClaim?: string;
}
export interface WaitingParticipantState {
    id: string;
    displayName: string | null;
}
export interface ChatMessageState {
    senderId: string;
    timestamp: string;
    text: string;
}
export type ScreenshareState = Screenshare;

type LocalScreenshareStatus = "starting" | "active";

export type ChatMessage = Pick<SignalChatMessage, "senderId" | "timestamp" | "text">;

export type CloudRecordingState = {
    error?: string;
    status: "recording" | "requested" | "error";
    startedAt?: number;
};

export type LiveStreamState = {
    status: "streaming";
    startedAt?: number;
};

export type BreakoutState = {
    isActive: boolean;
    currentGroup: {
        id: string | null;
        name: string;
    } | null;
    groupedParticipants: {
        clients: ClientView[];
        group: {
            id: string;
            name: string;
        } | null;
    }[];
    participantsInCurrentGroup: ClientView[];
};

export interface RoomConnectionState {
    connectionStatus: ConnectionStatus;
    chatMessages: ChatMessage[];
    cloudRecording?: CloudRecordingState;
    breakout: BreakoutState;
    events?: NotificationsEventEmitter;
    liveStream?: LiveStreamState;
    localScreenshareStatus?: LocalScreenshareStatus;
    localParticipant?: LocalParticipantState;
    remoteParticipants: RemoteParticipantState[];
    screenshares: Screenshare[];
    waitingParticipants: WaitingParticipantState[];
    spotlightedParticipants: ClientView[];
}

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
    joinRoom: () => void;
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
}
