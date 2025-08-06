import { RoleName, ChatMessage as SignalChatMessage } from "@whereby.com/media";
import { LocalParticipant, RemoteParticipant, Screenshare } from "../../RoomParticipant";
import { ClientView, ConnectionStatus, NotificationsEventEmitter } from "../../redux";

export type LocalMediaOptions = {
    audio: boolean;
    video: boolean;
};

export interface WherebyClientOptions {
    localMediaOptions?: LocalMediaOptions;
    displayName?: string;
    roomUrl?: string;
    roomKey?: string | null;
    externalId?: string | null;
    isNodeSdk?: boolean;
}
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

export type LocalScreenshareStatus = "starting" | "active";

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
