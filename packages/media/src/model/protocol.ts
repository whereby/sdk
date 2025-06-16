// Protocol enum used for the CLIENT (Make sure to keep it in sync with its server counterpart)

import { RtcEvents } from "../webrtc";
import { MEDIA_QUALITY } from "../webrtc/VegaMediaQualityMonitor";

// Requests: messages from the client to the server
export const PROTOCOL_REQUESTS = {
    BLOCK_CLIENT: "block_client",
    CLAIM_ROOM: "claim_room",
    CLEAR_CHAT_HISTORY: "clear_chat_history",
    ENABLE_AUDIO: "enable_audio",
    ENABLE_VIDEO: "enable_video",
    END_STREAM: "end_stream",
    FETCH_MEDIASERVER_CONFIG: "fetch_mediaserver_config",
    HANDLE_KNOCK: "handle_knock",
    IDENTIFY_DEVICE: "identify_device",
    INVITE_CLIENT_AS_MEMBER: "invite_client_as_member",
    JOIN_ROOM: "join_room",
    KICK_CLIENT: "kick_client",
    KNOCK_ROOM: "knock_room",
    LEAVE_ROOM: "leave_room",
    SEND_CLIENT_METADATA: "send_client_metadata",
    SET_LOCK: "set_lock",
    SHARE_MEDIA: "share_media",
    START_NEW_STREAM: "start_new_stream",
    START_SCREENSHARE: "start_screenshare",
    STOP_SCREENSHARE: "stop_screenshare",
    START_URL_EMBED: "start_url_embed",
    STOP_URL_EMBED: "stop_url_embed",
    START_RECORDING: "start_recording",
    STOP_RECORDING: "stop_recording",
};

// Responses: messages from the server to the client, in response to requests
export const PROTOCOL_RESPONSES = {
    AUDIO_ENABLED: "audio_enabled",
    BACKGROUND_IMAGE_CHANGED: "background_image_changed",
    BLOCK_ADDED: "block_added",
    BLOCK_REMOVED: "block_removed",
    CHAT_HISTORY_CLEARED: "chat_history_cleared",
    CLIENT_BLOCKED: "client_blocked",
    CLIENT_INVITED_AS_MEMBER: "client_invited_as_member",
    CLIENT_KICKED: "client_kicked",
    CLIENT_LEFT: "client_left",
    CLIENT_METADATA_RECEIVED: "client_metadata_received",
    CLIENT_READY: "client_ready",
    CLIENT_ROLE_CHANGED: "client_role_changed",
    CLIENT_USER_ID_CHANGED: "client_user_id_changed",
    CONTACTS_UPDATED: "contacts_updated",
    DEVICE_IDENTIFIED: "device_identified",
    ROOM_ROLES_UPDATED: "room_roles_updated",
    KNOCK_HANDLED: "knock_handled",
    KNOCK_PAGE_BACKGROUND_CHANGED: "knock_page_background_changed",
    KNOCKER_LEFT: "knocker_left",
    MEDIASERVER_CONFIG: "mediaserver_config",
    MEDIA_SHARED: "media_shared",
    MEMBER_INVITE: "member_invite",
    NEW_CLIENT: "new_client",
    NEW_STREAM_STARTED: "new_stream_started",
    SCREENSHARE_STARTED: "screenshare_started",
    SCREENSHARE_STOPPED: "screenshare_stopped",
    OWNER_NOTIFIED: "owner_notified",
    OWNERS_CHANGED: "owners_changed",
    PLAY_CLIENT_STICKER: "play_client_sticker",
    ROOM_INTEGRATION_ENABLED: "room_integration_enabled",
    ROOM_INTEGRATION_DISABLED: "room_integration_disabled",
    ROOM_JOINED: "room_joined",
    ROOM_KNOCKED: "room_knocked",
    ROOM_LEFT: "room_left",
    ROOM_LOCKED: "room_locked",
    ROOM_PERMISSIONS_CHANGED: "room_permissions_changed",
    ROOM_LOGO_CHANGED: "room_logo_changed",
    ROOM_TYPE_CHANGED: "room_type_changed",
    ROOM_MODE_CHANGED: "room_mode_changed",
    SOCKET_USER_ID_CHANGED: "socket_user_id_changed",
    STICKERS_UNLOCKED: "stickers_unlocked",
    STREAM_ENDED: "stream_ended",
    URL_EMBED_STARTED: "url_embed_started",
    URL_EMBED_STOPPED: "url_embed_stopped",
    RECORDING_STARTED: "recording_started",
    RECORDING_STOPPED: "recording_stopped",
    USER_NOTIFIED: "user_notified",
    VIDEO_ENABLED: "video_enabled",
    CLIENT_UNABLE_TO_JOIN: "client_unable_to_join",
    LIVE_TRANSCRIPTION_STARTED: "live_transcription_started",
    LIVE_TRANSCRIPTION_STOPPED: "live_transcription_stopped",
};

export const PROTOCOL_ERRORS = {
    CANNOT_INVITE_YOURSELF: "cannot_invite_yourself",
    CLIENT_MISSING_DEVICE_ID: "client_missing_device_id",
    FORBIDDEN: "forbidden",
    INTERNAL_SERVER_ERROR: "internal_server_error",
    INVALID_AVATAR: "invalid_avatar",
    INVALID_PARAMETERS: "invalid_parameters",
    INVALID_ROOM_NAME: "invalid_room_name",
    MISSING_PARAMETERS: "missing_parameters",
    MISSING_ROOM_NAME: "missing_room_name",
    NOT_AN_OWNER: "not_an_owner",
    NOT_IN_A_ROOM: "not_in_a_room",
    ROOM_ALREADY_CLAIMED: "room_already_claimed",
    ROOM_EMAIL_MISSING: "room_email_missing",
    ROOM_FULL: "room_full",
    ROOM_UNCLAIMED: "room_unclaimed",
    CLIENT_BLOCKED: "client_blocked",
    ROOM_LOCKED: "room_locked",
    TOO_LONG_TEXT: "too_long_text",
    VIDEO_STICKER_DOES_NOT_EXIST: "video_sticker_does_not_exist",
    VIDEO_STICKER_FORMAT_ERROR: "video_sticker_format_error",
    UNSUPPORTED_VIDEO_ENCODING: "unsupported_video_encoding",
};

// Relays: messages between clients, relayed through the server
export const RELAY_MESSAGES = {
    CHAT_MESSAGE: "chat_message",
    CHAT_READ_STATE: "chat_read_state",
    CHAT_STATE: "chat_state",
    ICE_CANDIDATE: "ice_candidate",
    ICE_END_OF_CANDIDATES: "ice_endofcandidates",
    READY_TO_RECEIVE_OFFER: "ready_to_receive_offer",
    REMOTE_CLIENT_MEDIA_REQUEST: "remote_client_media_request",
    SDP_ANSWER: "sdp_answer",
    SDP_OFFER: "sdp_offer",
    VIDEO_STICKER: "video_sticker",
};

// Actions and resolutions used with HANDLE_KNOCK and KNOCK_HANDLED
export const KNOCK_MESSAGES = {
    actions: {
        ACCEPT: "accept",
        HOLD: "hold",
        REJECT: "reject",
    },
    resolutions: {
        ACCEPTED: "accepted",
        ON_HOLD: "on_hold",
        REJECTED: "rejected",
    },
};

// Events: something happened that we want to let the client know about
export const PROTOCOL_EVENTS = {
    PENDING_CLIENT_LEFT: "pending_client_left",
    MEDIA_QUALITY_CHANGED: "media_quality_changed",
};
