import type { VideoSink } from "../utils/VideoEndpoints";
import type { AudioSink } from "../utils/AudioEndpoints";

export const ASSISTANT_JOINED_ROOM = "ASSISTANT_JOINED_ROOM";
export const ASSISTANT_LEFT_ROOM = "ASSISTANT_LEFT_ROOM";
export const PARTICIPANT_VIDEO_TRACK_ADDED = "PARTICIPANT_VIDEO_TRACK_ADDED";
export const PARTICIPANT_VIDEO_TRACK_REMOVED = "PARTICIPANT_VIDEO_TRACK_REMOVED";
export const PARTICIPANT_AUDIO_TRACK_ADDED = "PARTICIPANT_AUDIO_TRACK_ADDED";
export const PARTICIPANT_AUDIO_TRACK_REMOVED = "PARTICIPANT_AUDIO_TRACK_REMOVED";

export type AssistantEvents = {
    [ASSISTANT_JOINED_ROOM]: [{ roomUrl: string }];
    [ASSISTANT_LEFT_ROOM]: [{ roomUrl: string }];
    [PARTICIPANT_VIDEO_TRACK_ADDED]: [{ participantId: string; trackId: string; data: VideoSink }];
    [PARTICIPANT_VIDEO_TRACK_REMOVED]: [{ participantId: string; trackId: string }];
    [PARTICIPANT_AUDIO_TRACK_ADDED]: [{ participantId: string; trackId: string; data: AudioSink }];
    [PARTICIPANT_AUDIO_TRACK_REMOVED]: [{ participantId: string; trackId: string }];
};
