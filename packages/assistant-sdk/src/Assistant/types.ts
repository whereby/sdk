export const AUDIO_STREAM_READY = "AUDIO_STREAM_READY";

export type AssistantEvents = {
    [AUDIO_STREAM_READY]: [{ stream: MediaStream; track: MediaStreamTrack }];
};
