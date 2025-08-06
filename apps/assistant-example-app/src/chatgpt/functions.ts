import { z } from "zod";

const participantIdParameter = z.object({
    type: z.literal("object"),
    properties: z.object({
        participant_id: z.object({
            type: z.literal("string"),
            description: z.string(),
        }),
    }),
    required: z.array(z.literal("participant_id")).optional(),
});

const chatMessageParameter = z.object({
    type: z.literal("object"),
    properties: z.object({
        text: z.object({
            type: z.literal("string"),
            description: z.string(),
        }),
    }),
    required: z.array(z.literal("text")),
});

const emptyParameters = z.object({});

const functionDefinition = z.object({
    type: z.literal("function"),
    name: z.string(),
    description: z.string(),
    parameters: z.union([emptyParameters, chatMessageParameter, participantIdParameter]),
});

const sessionUpdateSchema = z.object({
    type: z.literal("session.update"),
    session: z.object({
        tools: z.array(functionDefinition),
        tool_choice: z.literal("auto"),
    }),
});

export const functions = {
    type: "session.update",
    session: {
        tools: [
            {
                type: "function",
                name: "start_cloud_recording",
                description: "Start cloud recording",
                parameters: {},
            },
            {
                type: "function",
                name: "stop_cloud_recording",
                description: "Stop cloud recording",
                parameters: {},
            },
            {
                type: "function",
                name: "send_chat_message",
                description: "Send a chat message",
                parameters: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description:
                                "The text of the message to send. If asked about mentions or tags, find the participant in the room list, and mention them by their display name, adding a '@' prefix.",
                        },
                    },
                    required: ["text"],
                },
            },
            {
                type: "function",
                name: "list_participants",
                description: "List participants in the room",
                parameters: {},
            },
            {
                type: "function",
                name: "spotlight_participant",
                description: "Spotlight a participant in the room",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to spotlight. Get the participant ID from the participant list, using the display name.",
                        },
                    },
                    required: ["participant_id"],
                },
            },
            {
                type: "function",
                name: "remove_spotlight",
                description: "Remove spotlight from a participant in the room",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to remove spotlight from. Get the participant ID from the participant list, using the display name.",
                        },
                    },
                },
            },
            {
                type: "function",
                name: "request_audio_enable",
                description:
                    "Request that the participant enables microphone. The participant needs to accept, because of privacy reasons, we don't just turn it on, we send a request. Get the participant ID from the participant list, using the display name.",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to enable audio/microphone for. Get the participant ID from the participant list, using the display name.",
                        },
                    },
                },
            },
            {
                type: "function",
                name: "request_audio_disable",
                description:
                    "Disable the audio/microphone for the participant. Get the participant ID from the participant list, using the display name.",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to disable audio/microphone for. Get the participant ID from the participant list, using the display name.",
                        },
                    },
                },
            },
            {
                type: "function",
                name: "request_video_enable",
                description:
                    "Request that the participant enables video/camera. The participant needs to accept, because of privacy reasons, we don't just turn it on, we send a request. Get the participant ID from the participant list, using the display name.",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to enable video/camera for. Get the participant ID from the participant list, using the display name.",
                        },
                    },
                },
            },
            {
                type: "function",
                name: "request_video_disable",
                description:
                    "Disable the video/camera for the participant. Get the participant ID from the participant list, using the display name.",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to disable video/camera for. Get the participant ID from the participant list, using the display name.",
                        },
                    },
                },
            },
            {
                type: "function",
                name: "accept_waiting_participant",
                description:
                    "Accept the waiting participant/knocker. Get the participant ID from the waiting participant list, using the display name.",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to accept. Get the participant ID from the waiting participant list, using the display name.",
                        },
                    },
                },
            },
            {
                type: "function",
                name: "reject_waiting_participant",
                description:
                    "Reject the waiting participant/knocker. Get the participant ID from the waiting participant list, using the display name.",
                parameters: {
                    type: "object",
                    properties: {
                        participant_id: {
                            type: "string",
                            description:
                                "The participant ID to reject. Get the participant ID from the waiting participant list, using the display name.",
                        },
                    },
                },
            },
        ],
        tool_choice: "auto",
    },
} satisfies z.infer<typeof sessionUpdateSchema>;

export { sessionUpdateSchema, functionDefinition, participantIdParameter, chatMessageParameter };

export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;
export type FunctionDefinition = z.infer<typeof functionDefinition>;
