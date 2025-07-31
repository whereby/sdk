import { RoomJoinedErrors } from "@whereby.com/media";
import { ChatMessage, ClientView, ConnectionStatus } from "../../redux";
import { Screenshare, WaitingParticipant } from "../../RoomParticipant";
import {
    BreakoutState,
    CloudRecordingState,
    LiveStreamState,
    LocalParticipantState,
    RemoteParticipantState,
} from "./types";

/* Breakout Events */
export const BREAKOUT_CONFIG_CHANGED = "breakout:config-changed";
/* Chat Events */
export const CHAT_NEW_MESSAGE = "chat:new-message";
/* Cloud Recording Events */
export const CLOUD_RECORDING_STATUS_CHANGED = "cloud-recording:status-changed";
/* Connection Status Events */
export const CONNECTION_STATUS_CHANGED = "connection:status-changed";
/* Local participant events */
export const LOCAL_PARTICIPANT_JOINED = "local-participant:joined";
export const LOCAL_PARTICIPANT_LEFT = "local-participant:left";
/* Remote participant events */
export const REMOTE_PARTICIPANT_JOINED = "remote-participant:joined";
export const REMOTE_PARTICIPANT_LEFT = "remote-participant:left";
export const REMOTE_PARTICIPANT_CHANGED = "remote-participant:changed";
/* Screen share events */
export const SCREENSHARE_STARTED = "screenshare:started";
export const SCREENSHARE_STOPPED = "screenshare:stopped";

/* Streaming events */
export const STREAMING_STARTED = "streaming:started";
export const STREAMING_STOPPED = "streaming:stopped";

/* Waiting participant events */
export const WAITING_PARTICIPANT_JOINED = "waiting-participant:joined";
export const WAITING_PARTICIPANT_LEFT = "waiting-participant:left";

/* Spotlight participant events */
export const SPOTLIGHT_PARTICIPANT_ADDED = "spotlight:participant-added";
export const SPOTLIGHT_PARTICIPANT_REMOVED = "spotlight:participant-removed";

/* Room joined events */
export const ROOM_JOINED = "room:joined";
export const ROOM_JOINED_ERROR = "room:joined:error";

type RoomJoinedEvent = {
    isLocked: boolean;
    selfId: string;
};

/* Event types for RoomConnection client */
export type RoomConnectionEvents = {
    [BREAKOUT_CONFIG_CHANGED]: [config: BreakoutState];
    [CHAT_NEW_MESSAGE]: [message: ChatMessage];
    [CLOUD_RECORDING_STATUS_CHANGED]: [status: CloudRecordingState | undefined];
    [CONNECTION_STATUS_CHANGED]: [status: ConnectionStatus];
    [LOCAL_PARTICIPANT_JOINED]: [participant: LocalParticipantState];
    [LOCAL_PARTICIPANT_LEFT]: [participantId: string];
    [REMOTE_PARTICIPANT_JOINED]: [participant: RemoteParticipantState];
    [REMOTE_PARTICIPANT_LEFT]: [participantId: string];
    [REMOTE_PARTICIPANT_CHANGED]: [participant: RemoteParticipantState];
    [SCREENSHARE_STARTED]: [screenshare: Screenshare];
    [SCREENSHARE_STOPPED]: [screenshareId: string];
    [ROOM_JOINED]: [room: RoomJoinedEvent];
    [ROOM_JOINED_ERROR]: [error: RoomJoinedErrors | string];
    [WAITING_PARTICIPANT_JOINED]: [participant: WaitingParticipant];
    [WAITING_PARTICIPANT_LEFT]: [participantId: string];
    [SPOTLIGHT_PARTICIPANT_ADDED]: [participant: ClientView];
    [SPOTLIGHT_PARTICIPANT_REMOVED]: [participantId: string];
    [STREAMING_STARTED]: [streaming: LiveStreamState];
    [STREAMING_STOPPED]: [];
};
