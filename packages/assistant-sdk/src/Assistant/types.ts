export const AUDIO_STREAM_READY = "AUDIO_STREAM_READY";
export const ASSISTANT_JOINED_ROOM = "ASSISTANT_JOINED_ROOM";
export const ASSISTANT_LEFT_ROOM = "ASSISTANT_LEFT_ROOM";

export type AssistantEvents = {
    [ASSISTANT_JOINED_ROOM]: [{ roomUrl: string }];
    [ASSISTANT_LEFT_ROOM]: [{ roomUrl: string }];
    [AUDIO_STREAM_READY]: [{ stream: MediaStream; track: MediaStreamTrack }];
};
