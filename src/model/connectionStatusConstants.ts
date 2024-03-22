import { RtcEvents } from "src/webrtc/types";

export const EVENTS: Record<string, keyof RtcEvents> = {
    CLIENT_CONNECTION_STATUS_CHANGED: "client_connection_status_changed",
    STREAM_ADDED: "stream_added",
    RTC_MANAGER_CREATED: "rtc_manager_created",
    RTC_MANAGER_DESTROYED: "rtc_manager_destroyed",
    LOCAL_STREAM_TRACK_ADDED: "local_stream_track_added",
    LOCAL_STREAM_TRACK_REMOVED: "local_stream_track_removed",
    REMOTE_STREAM_TRACK_ADDED: "remote_stream_track_added",
    REMOTE_STREAM_TRACK_REMOVED: "remote_stream_track_removed",
};

export const TYPES = {
    CONNECTING: "connecting",
    CONNECTION_FAILED: "connection_failed",
    CONNECTION_SUCCESSFUL: "connection_successful",
    CONNECTION_DISCONNECTED: "connection_disconnected",
};
