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

export interface ClientRole {
    roleName: string;
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
        session: {
            createdAt: string;
            id: string;
        } | null;
    };
    selfId: string;
}

export interface RoomKnockedEvent {
    clientId: string;
    displayName: string | null;
    imageUrl: string | null;
    liveVideo: boolean;
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

export interface ClientMetadataReceivedEvent {
    type: string;
    payload: { clientId: string; displayName: string };
}

export interface SignalEvents {
    audio_enabled: AudioEnabledEvent;
    client_left: ClientLeftEvent;
    client_kicked: ClientKickedEvent;
    client_metadata_received: ClientMetadataReceivedEvent;
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
    room_session_ended: RoomSessionEndedEvent;
    screenshare_started: ScreenshareStartedEvent;
    screenshare_stopped: ScreenshareStoppedEvent;
    streaming_stopped: void;
    video_enabled: VideoEnabledEvent;
}

export interface IdentifyDeviceRequest {
    deviceCredentials: Credentials;
}

export interface JoinRoomRequest {
    config: { isAudioEnabled: boolean; isVideoEnabled: boolean };
    organizationId: string;
    roomName: string;
    displayName?: string;
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

export interface SignalRequests {
    chat_message: { text: string };
    enable_audio: { enabled: boolean };
    enable_video: { enabled: boolean };
    handle_knock: { action: "accept" | "reject"; clientId: string; response: unknown };
    identify_device: IdentifyDeviceRequest;
    join_room: JoinRoomRequest;
    knock_room: KnockRoomRequest;
    leave_room: void;
    send_client_metadata: { type: string; payload: { displayName?: string } };
    start_recording: { recording: string };
    stop_recording: void;
}
