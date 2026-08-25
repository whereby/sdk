import { RoleName, ChatFileShare, ChatMessage as SignalChatMessage, KnockResponse } from "@whereby.com/media";
import { LocalParticipant, RemoteParticipant, Screenshare } from "../../RoomParticipant";
import { ClientView, ConnectionStatus, FileUpload, NotificationsEventEmitter } from "../../redux";
import LiveCaption from "../../api/models/LiveCaption";

export type { RoomJoinedSuccess, ChatFileShare, KnockResponse, KnockResponseSender } from "@whereby.com/media";
export type { FileUpload, FileShareError } from "../../redux";

export type LocalMediaOptions = {
    audio: boolean;
    video: boolean;
};

export interface WherebyClientOptions {
    localMediaOptions?: LocalMediaOptions;
    displayName?: string;
    roomUrl?: string;
    assistantKey?: string | null;
    roomKey?: string | null;
    externalId?: string | null;
    isNodeSdk?: boolean;
}

export interface PrecallTestOptions {
    roomUrl?: string;
}

export type RemoteParticipantState = Omit<RemoteParticipant, "newJoiner" | "streams"> & {
    breakoutGroupAssigned: string;
};
export interface LocalParticipantState extends LocalParticipant {
    isScreenSharing: boolean;
    roleName: RoleName;
    clientClaim?: string;
    breakoutGroupAssigned: string;
}
export interface WaitingParticipantState {
    id: string;
    displayName: string | null;
}
export interface ChatMessageState {
    senderId: string;
    timestamp: string;
    text: string;
    file?: ChatFileShare;
}
export type ScreenshareState = Screenshare;

export type LocalScreenshareStatus = "starting" | "active";

export type ChatMessage = Pick<SignalChatMessage, "id" | "senderId" | "parentId" | "timestamp" | "text" | "sig"> & {
    removed: boolean;
    file?: ChatFileShare;
};

export type CloudRecordingState = {
    error?: string;
    status: "recording" | "requested" | "error";
    startedAt?: number;
};

export type LiveCaptionsState = {
    error?: string;
    status: "captioning" | "requested" | "error";
    startedAt?: number;
    captionLog: Array<LiveCaption>;
};

export type LiveTranscriptionState = {
    error?: string;
    status: "transcribing" | "requested" | "error";
    startedAt?: number;
};

export type LiveStreamState = {
    status: "streaming";
    startedAt?: number;
};

export type BreakoutState = {
    /** Breakout groups require a group (SFU) room; false in peer-to-peer rooms. */
    isAvailable: boolean;
    /** Set when a breakout action was refused, e.g. starting a session in a peer-to-peer room. */
    error: string | null;
    isActive: boolean;
    currentGroup: {
        id: string | null;
        name: string;
    } | null;
    groups: { [groupId: string]: string } | null;
    enforceAssignment: boolean;
    autoMoveToGroup: boolean;
    moveToGroupGracePeriod: number | null;
    autoMoveToMain: boolean;
    moveToMainGracePeriod: number | null;
    breakoutTimerSetting: boolean;
    breakoutTimerDuration: number;
    startedAt: Date | null;
    endTime: number | null;
    moveToGroupAt: number | null;
    moveToMainAt: number | null;
    groupedParticipants: {
        clients: ClientView[];
        group: {
            id: string;
            name: string;
        } | null;
    }[];
    participantsInCurrentGroup: ClientView[];
    broadcastingParticipants: ClientView[];
};

export interface RoomConnectionState {
    connectionStatus: ConnectionStatus;
    connectionError: string | null;
    knockResponse: KnockResponse | null;
    chatMessages: ChatMessage[];
    fileUploads: FileUpload[];
    cloudRecording?: CloudRecordingState;
    breakout: BreakoutState;
    events?: NotificationsEventEmitter;
    isCameraEnabled: boolean;
    isMicrophoneEnabled: boolean;
    liveStream?: LiveStreamState;
    liveCaptions?: LiveCaptionsState;
    liveTranscription?: LiveTranscriptionState;
    localScreenshareStatus?: LocalScreenshareStatus;
    localParticipant?: LocalParticipantState;
    remoteParticipants: RemoteParticipantState[];
    screenshares: Screenshare[];
    waitingParticipants: WaitingParticipantState[];
    spotlightedParticipants: ClientView[];
}
