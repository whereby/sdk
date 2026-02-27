export interface Credentials {
    credentials: {
        uuid: string;
    };
    hmac: string;
    userId: string;
}

/*
    Socket
*/

export interface SocketConf {
    host?: string;
    path?: string;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
    timeout?: number;
    autoConnect?: boolean;
}

export interface SocketManager {
    on: (eventName: string, callback: (args: unknown) => void) => void;
}

export type RoleName =
    | "none"
    | "visitor"
    | "granted_visitor"
    | "viewer"
    | "granted_viewer"
    | "host"
    | "recorder"
    | "streamer"
    | "captioner"
    | "assistant";

export interface ClientRole {
    roleName: RoleName;
}

export interface SignalKnocker {
    clientId: string;
    displayName: string | null;
    imageUrl: string | null;
    liveVideo: boolean;
    userAvatarUrl: string | null;
    userId: string | null;
}

export interface SignalClient {
    displayName: string;
    id: string;
    streams: string[];
    deviceId: string;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    role: ClientRole;
    startedCloudRecordingAt: string | null;
    breakoutGroup: string | null;
    externalId: string | null;
    isDialIn: boolean;
    isAudioRecorder: boolean;
}

export interface Spotlight {
    clientId: string;
    streamId: string;
}

export type RoomMode = "normal" | "group";

export interface AudioEnabledEvent {
    clientId: string;
    isAudioEnabled: boolean;
}

export interface BreakoutGroupJoinedEvent {
    clientId: string;
    group: string;
}

export interface ChatMessage {
    id: string;
    messageType: "text";
    roomName: string;
    senderId: string;
    sig: string;
    text: string;
    timestamp: string;
    userId: string;
    breakoutGroup?: string;
    broadcast?: boolean;
}

export interface CloudRecordingStartedEvent {
    error?: string;
    startedAt?: string;
}

export interface ClientLeftEvent {
    clientId: string;
}
export interface NewClientEvent {
    client: SignalClient;
    room?: {
        session: {
            createdAt: string;
            id: string;
        } | null;
    };
}

export interface ClientKickedEvent {
    clientId: string;
}

export interface KnockerLeftEvent {
    clientId: string;
}

export interface KnockAcceptedEvent {
    clientId: string;
    metadata: {
        roomKey: string;
        roomName: string;
    };
    resolution: "accepted";
}

export interface KnockRejectedEvent {
    clientId: string;
    resolution: "rejected";
}

export interface BreakoutConfig {
    assignments?: {
        [key: string]: string;
    } | null;
    autoMoveToGroup?: boolean;
    autoMoveToMain?: boolean;
    breakoutEnabledAt?: string | null;
    breakoutNotification?: string | null;
    breakoutTimerDuration?: number;
    breakoutStartedAt?: string | null;
    breakoutEndedAt?: string | null;
    breakoutTimerSetting?: boolean;
    moveToGroupGracePeriod?: number | null;
    moveToMainGracePeriod?: number | null;
    enforceAssignment?: boolean;
    groups?: {
        [key: string]: string;
    } | null;
    initiatedBy?: {
        clientId: string;
        userId: string;
        deviceId: string;
        active: boolean;
    } | null;
    startedAt?: Date | null;
}

export interface RoomLockedError {
    error: "room_locked";
    isClaimed: boolean;
    isLocked: boolean;
    selfId: string;
    logoUrl?: string;
    knockPageBackgroundImageUrl?: string;
}

export interface RoomFullError {
    error: "room_full";
    isClaimed: boolean;
}

export interface RoomConcurrencyControlsError {
    error: "room_concurrency_control_error";
}

export interface CannotJoinUnclaimedRoomError {
    error: "room_unclaimed";
}

export interface OrganizationPlanExhaustedError {
    error: "free_tier_exhausted";
}

export interface RoomMeetingTimeExhaustedError {
    error: "room_meeting_time_exhausted";
}

export interface MaxViewerLimitReachedError {
    error: "max_viewer_limit_reached";
    isClaimed: boolean;
}

export interface HostPresenceControlsError {
    error: "host_presence_controls_error";
}

export interface InternalServerError {
    error: "internal_server_error";
}

export interface InvalidAssistantKeyError {
    error: "invalid_assistant_key";
}

export interface OrganizationAssistantNotFoundError {
    error: "organization_assistant_not_found";
}

export interface OrganizationAssistantNotEnabledError {
    error: "organization_assistant_not_enabled";
}

export type ForbiddenErrorNames =
    | "missing_parameters"
    | "invalid_parameters"
    | "invalid_room_name"
    | "invalid_key"
    | "invalid_avatar";

export interface ForbiddenError {
    error: ForbiddenErrorNames;
}

export type RoomJoinedErrors =
    | RoomLockedError
    | RoomFullError
    | RoomConcurrencyControlsError
    | CannotJoinUnclaimedRoomError
    | OrganizationPlanExhaustedError
    | RoomMeetingTimeExhaustedError
    | MaxViewerLimitReachedError
    | HostPresenceControlsError
    | ForbiddenError
    | InternalServerError
    | InvalidAssistantKeyError
    | OrganizationAssistantNotFoundError
    | OrganizationAssistantNotEnabledError;
export type RoomJoinedErrorMessage = RoomJoinedErrors["error"];

export interface RoomJoinedSuccess {
    room: {
        mode: RoomMode;
        isClaimed: boolean;
        isLocked: boolean;
        clients: SignalClient[];
        knockers: SignalKnocker[];
        spotlights: Spotlight[];
        session: {
            createdAt: string;
            id: string;
        } | null;
    };
    selfId: string;
    breakoutGroup?: string | null;
    clientClaim: string;
    breakout?: BreakoutConfig;
}

export type RoomJoinedEvent = RoomJoinedErrors | RoomJoinedSuccess;

export interface BreakoutSessionUpdatedEvent extends BreakoutConfig {}

export interface RoomKnockedEvent {
    clientId: string;
    displayName: string | null;
    imageUrl: string | null;
    liveVideo: boolean;
    selfId?: string;
    clientClaim?: string;
}

export interface RoomLockedEvent {
    isLocked: boolean;
}

export interface RoomSessionEndedEvent {
    roomSessionId: string;
}

export interface ScreenshareStartedEvent {
    clientId: string;
    streamId: string;
    hasAudioTrack: boolean;
}

export interface ScreenshareStoppedEvent {
    clientId: string;
    streamId: string;
}

export interface VideoEnabledEvent {
    clientId: string;
    isVideoEnabled: boolean;
}

export interface ClientMetadataPayload {
    displayName: string;
    stickyReaction?: {
        reaction: string;
        timestamp: string;
    } | null;
}

export interface ClientMetadataReceivedEvent {
    error?: string;
    type?: string;
    payload?: ClientMetadataPayload & {
        clientId: string;
    };
}

export interface ClientUnableToJoinEvent {
    displayName: string;
    error: string;
}

export interface AudioEnableRequestedEvent {
    requestedByClientId: string;
    enable: boolean;
}

export interface VideoEnableRequestedEvent {
    requestedByClientId: string;
    enable: boolean;
}

export interface SpotlightAddedEvent {
    clientId: string;
    streamId: string;
    requestedByClientId: string;
}

export interface SpotlightRemovedEvent {
    clientId: string;
    streamId: string;
    requestedByClientId: string;
}

export interface LiveTranscriptionStartedEvent {
    transcriptionId: string;
    startedAt: string;
}

export interface LiveTranscriptionStoppedEvent {
    transcriptionId: string;
    endedAt: string;
}

export interface SignalEvents {
    audio_enabled: AudioEnabledEvent;
    audio_enable_requested: AudioEnableRequestedEvent;
    breakout_group_joined: BreakoutGroupJoinedEvent;
    breakout_session_updated: BreakoutSessionUpdatedEvent;
    client_left: ClientLeftEvent;
    client_kicked: ClientKickedEvent;
    client_metadata_received: ClientMetadataReceivedEvent;
    client_unable_to_join: ClientUnableToJoinEvent;
    cloud_recording_started: CloudRecordingStartedEvent;
    cloud_recording_stopped: void;
    chat_message: ChatMessage;
    connect: void;
    connect_error: void;
    device_identified: void;
    disconnect: void;
    knock_handled: KnockAcceptedEvent | KnockRejectedEvent;
    knocker_left: KnockerLeftEvent;
    new_client: NewClientEvent;
    room_joined: RoomJoinedEvent;
    room_knocked: RoomKnockedEvent;
    room_left: void;
    room_locked: RoomLockedEvent;
    room_session_ended: RoomSessionEndedEvent;
    screenshare_started: ScreenshareStartedEvent;
    screenshare_stopped: ScreenshareStoppedEvent;
    spotlight_added: SpotlightAddedEvent;
    spotlight_removed: SpotlightRemovedEvent;
    streaming_stopped: void;
    video_enabled: VideoEnabledEvent;
    video_enable_requested: VideoEnableRequestedEvent;
    live_transcription_started: LiveTranscriptionStartedEvent;
    live_transcription_stopped: LiveTranscriptionStoppedEvent;
    live_captions_started: void;
    live_captions_stopped: void;
}

export interface IdentifyDeviceRequest {
    deviceCredentials: Credentials;
}

export interface JoinRoomRequest {
    config: { isAudioEnabled: boolean; isVideoEnabled: boolean };
    organizationId: string;
    roomName: string;
    displayName?: string;
    clientClaim?: string;
}

export interface KnockRoomRequest {
    displayName: string;
    imageUrl: string | null;
    kickFromOtherRooms: boolean;
    liveVideo: boolean;
    organizationId: string;
    roomKey: string | null;
    roomName: string;
}

export interface SendClientMetadataRequest {
    type: string;
    payload: ClientMetadataPayload;
}

export interface AudioEnableRequest {
    clientIds: string[];
    enable: boolean;
}

export interface VideoEnableRequest {
    clientIds: string[];
    enable: boolean;
}

export interface AddSpotlightRequest {
    clientId: string;
    streamId: string;
}

export interface RemoveSpotlightRequest {
    clientId: string;
    streamId: string;
}

export interface SignalRequests {
    add_spotlight: AddSpotlightRequest;
    chat_message: { text: string };
    enable_audio: { enabled: boolean };
    enable_video: { enabled: boolean };
    handle_knock: { action: "accept" | "reject"; clientId: string; response: unknown };
    identify_device: IdentifyDeviceRequest;
    join_room: JoinRoomRequest;
    knock_room: KnockRoomRequest;
    leave_room: void;
    remove_spotlight: RemoveSpotlightRequest;
    request_audio_enable: AudioEnableRequest;
    request_video_enable: VideoEnableRequest;
    send_client_metadata: { type: string; payload: { displayName?: string; stickyReaction?: unknown } };
    set_lock: { locked: boolean };
    start_recording: { recording: string };
    stop_recording: void;
}

export type TurnTransportProtocol = "onlyudp" | "onlytcp" | "onlytls";
