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
    | "streamer";

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
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    role: ClientRole;
    startedCloudRecordingAt: string | null;
    externalId: string | null;
    isDialIn: boolean;
}

export interface Spotlight {
    clientId: string;
    streamId: string;
}

export interface AudioEnabledEvent {
    clientId: string;
    isAudioEnabled: boolean;
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

export interface RoomJoinedEvent {
    error?: string;
    isLocked: boolean;
    room?: {
        clients: SignalClient[];
        knockers: SignalKnocker[];
        spotlights: Spotlight[];
        session: {
            createdAt: string;
            id: string;
        } | null;
    };
    selfId: string;
    clientClaim?: string;
}

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
    startedAt: string;
    transcriptionId: string;
}

export interface LiveTranscriptionStoppedEvent {
    transcriptionId: string;
}

export interface SignalEvents {
    audio_enabled: AudioEnabledEvent;
    audio_enable_requested: AudioEnableRequestedEvent;
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
    live_transcription_started: LiveTranscriptionStartedEvent;
    live_transcription_stopped: LiveTranscriptionStoppedEvent;
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
    send_client_metadata: { type: string; payload: { displayName?: string; stickyReaction?: unknown } };
    set_lock: { locked: boolean };
    start_recording: { recording: string };
    stop_recording: void;
}

export type TurnTransportProtocol = "onlyudp" | "onlytcp" | "onlytls";
