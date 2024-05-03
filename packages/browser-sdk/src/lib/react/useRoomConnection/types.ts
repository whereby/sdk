import {
    ChatMessage as SignalChatMessage,
    NotificationMessage,
    LocalParticipant,
    RemoteParticipant,
    Screenshare,
    LocalMediaOptions,
    ConnectionStatus,
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

export interface RoomConnectionState {
    connectionStatus: ConnectionStatus;
    chatMessages: ChatMessage[];
    cloudRecording?: CloudRecordingState;
    liveStream?: LiveStreamState;
    localScreenshareStatus?: LocalScreenshareStatus;
    localParticipant?: LocalParticipantState;
    notifications: NotificationMessage[];
    remoteParticipants: RemoteParticipantState[];
    screenshares: Screenshare[];
    waitingParticipants: WaitingParticipantState[];
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
    toggleLowDataMode(enabled?: boolean): void;
    acceptWaitingParticipant(participantId: string): void;
    knock(): void;
    joinRoom(): void;
    leaveRoom(): void;
    lockRoom(locked: boolean): void;
    muteParticipants(clientIds: string[]): void;
    kickParticipant(clientId: string): void;
    endMeeting(stayBehind?: boolean): void;
    rejectWaitingParticipant(participantId: string): void;
    sendChatMessage(text: string): void;
    setDisplayName(displayName: string): void;
    startCloudRecording(): void;
    startScreenshare(): void;
    stopCloudRecording(): void;
    stopScreenshare(): void;
    toggleCamera(enabled?: boolean): void;
    toggleMicrophone(enabled?: boolean): void;
}
