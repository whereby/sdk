import { z } from "zod";

export const eventName = z.enum([
    "start_cloud_recording",
    "stop_cloud_recording",
    "send_chat_message",
    "list_participants",
    "spotlight_participant",
    "remove_spotlight",
    "request_audio_enable",
    "request_audio_disable",
    "request_video_enable",
    "request_video_disable",
    "accept_waiting_participant",
    "reject_waiting_participant",
]);

export type EventName = z.infer<typeof eventName>;

export const startCloudRecordingEvent = z.object({
    type: z.literal("start_cloud_recording"),
});

export type StartCloudRecordingEvent = z.infer<typeof startCloudRecordingEvent>;

export const stopCloudRecordingEvent = z.object({
    type: z.literal("stop_cloud_recording"),
});

export type StopCloudRecordingEvent = z.infer<typeof stopCloudRecordingEvent>;

export const sendChatMessageEvent = z.object({
    type: z.literal("send_chat_message"),
    parameters: z.object({
        text: z
            .string()
            .describe(
                "The text of the message to send. If asked about mentions or tags, find the participant in the room list, and mention them by their display name, adding a '@' prefix.",
            ),
    }),
});

export type SendChatMessageEvent = z.infer<typeof sendChatMessageEvent>;

export const listParticipantsEvent = z.object({
    type: z.literal("list_participants"),
});

export type ListParticipantsEvent = z.infer<typeof listParticipantsEvent>;

export const spotlightParticipantEvent = z.object({
    type: z.literal("spotlight_participant"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to spotlight. Get the participant ID from the participant list, using the display name.",
            ),
    }),
});

export type SpotlightParticipantEvent = z.infer<typeof spotlightParticipantEvent>;

export const removeSpotlightEvent = z.object({
    type: z.literal("remove_spotlight"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to remove spotlight from. Get the participant ID from the participant list, using the display name.",
            ),
    }),
});

export type RemoveSpotlightEvent = z.infer<typeof removeSpotlightEvent>;

export const requestAudioEnableEvent = z.object({
    type: z.literal("request_audio_enable"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to enable audio/microphone for. Get the participant ID from the participant list, using the display name.",
            ),
    }),
});

export type RequestAudioEnableEvent = z.infer<typeof requestAudioEnableEvent>;

export const requestAudioDisableEvent = z.object({
    type: z.literal("request_audio_disable"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to disable audio/microphone for. Get the participant ID from the participant list, using the display name.",
            ),
    }),
});

export type RequestAudioDisableEvent = z.infer<typeof requestAudioDisableEvent>;

export const requestVideoEnableEvent = z.object({
    type: z.literal("request_video_enable"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to enable video/camera for. Get the participant ID from the participant list, using the display name.",
            ),
    }),
});

export type RequestVideoEnableEvent = z.infer<typeof requestVideoEnableEvent>;

export const requestVideoDisableEvent = z.object({
    type: z.literal("request_video_disable"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to disable video/camera for. Get the participant ID from the participant list, using the display name.",
            ),
    }),
});

export type RequestVideoDisableEvent = z.infer<typeof requestVideoDisableEvent>;

export const acceptWaitingParticipantEvent = z.object({
    type: z.literal("accept_waiting_participant"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to accept. Get the participant ID from the waiting participant list, using the display name.",
            ),
    }),
});

export type AcceptWaitingParticipantEvent = z.infer<typeof acceptWaitingParticipantEvent>;

export const rejectWaitingParticipantEvent = z.object({
    type: z.literal("reject_waiting_participant"),
    parameters: z.object({
        participant_id: z
            .string()
            .describe(
                "The participant ID to reject. Get the participant ID from the waiting participant list, using the display name.",
            ),
    }),
});

export type RejectWaitingParticipantEvent = z.infer<typeof rejectWaitingParticipantEvent>;

export const eventSchema = z.discriminatedUnion("type", [
    startCloudRecordingEvent,
    stopCloudRecordingEvent,
    sendChatMessageEvent,
    listParticipantsEvent,
    spotlightParticipantEvent,
    removeSpotlightEvent,
    requestAudioEnableEvent,
    requestAudioDisableEvent,
    requestVideoEnableEvent,
    requestVideoDisableEvent,
    acceptWaitingParticipantEvent,
    rejectWaitingParticipantEvent,
]);

export type Event = z.infer<typeof eventSchema>;
