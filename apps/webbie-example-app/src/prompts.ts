import { z } from "zod";

const contentItem = z.object({
    type: z.literal("input_text"),
    text: z.string(),
});

const messageItem = z.object({
    id: z.null(),
    type: z.literal("message"),
    role: z.enum(["system", "user", "assistant"]),
    content: z.array(contentItem),
});

const conversationItemCreate = z.object({
    type: z.literal("conversation.item.create"),
    previous_item_id: z.null(),
    item: messageItem,
});

const participantInfo = z.object({
    displayName: z.string(),
    id: z.string(),
});

export const systemPrompt = {
    type: "conversation.item.create",
    previous_item_id: null,
    item: {
        id: null,
        type: "message",
        role: "system",
        content: [
            {
                type: "input_text",
                text: `You are Webbie, a helpful assistant for Whereby rooms. Whereby is a video conferencing platform. You have access to the state of the room, such as the list of participants and their display names. You also have access to do actions in the room, such as sending chat messages. You can only respond when someone addresses you by name, "Hey Webbie" or "Okay Webbie". You can ***ONLY*** answer if you hear ***Webbie***, otherwise do not respond to questions. When you respond, be concise and to the point. When possible, use affirmative language like "Sure!" or "Absolutely!" to sound more engaging. If it's a longer question, prefer to answer in the chat, unless
otherwise specified.
`,
            },
        ],
    },
} satisfies z.infer<typeof conversationItemCreate>;

export const sessionUpdate = {
    type: "session.update",
    session: {
        // Keep VAD so you get boundaries & transcripts
        turn_detection: {
            type: "server_vad",
            create_response: false, // critical: don't speak automatically
            interrupt_response: false, // optional
            threshold: 0.5, // tune as needed
            prefix_padding_ms: 300,
            silence_duration_ms: 800,
        },
        input_audio_transcription: {
            model: "whisper-1",
        },
    },
};

export const participantListPrompt = (participantList: z.infer<typeof participantInfo>[]) => {
    return {
        type: "conversation.item.create",
        previous_item_id: null,
        item: {
            id: null,
            type: "message",
            role: "system",
            content: [
                {
                    type: "input_text",
                    text: `This is the participant list: ${JSON.stringify(participantList)}. Whenever asked about this, just list the display names of the participants in the room.`,
                },
            ],
        },
    } satisfies z.infer<typeof conversationItemCreate>;
};

export { conversationItemCreate, messageItem, contentItem, participantInfo };

export type ConversationItemCreate = z.infer<typeof conversationItemCreate>;
export type MessageItem = z.infer<typeof messageItem>;
export type ContentItem = z.infer<typeof contentItem>;
export type ParticipantInfo = z.infer<typeof participantInfo>;
