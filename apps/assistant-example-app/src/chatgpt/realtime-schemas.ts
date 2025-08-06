import { z } from "zod";

export const functionCallItem = z.object({
    type: z.literal("function_call"),
    name: z.string(),
    arguments: z.string(),
});

export const responseOutputItemDoneEvent = z.object({
    type: z.literal("response.output_item.done"),
    item: functionCallItem,
});

export type ResponseOutputItemDoneEvent = z.infer<typeof responseOutputItemDoneEvent>;

export const responseCreateEvent = z.object({
    type: z.literal("response.create"),
});

export type ResponseCreateEvent = z.infer<typeof responseCreateEvent>;

export const chatMessageArguments = z.object({
    text: z.string(),
});

export const participantIdArguments = z.object({
    participant_id: z.string(),
});

export const incomingRealtimeEvent = z.discriminatedUnion("type", [responseOutputItemDoneEvent]);

export const outgoingRealtimeEvent = z.discriminatedUnion("type", [responseCreateEvent]);

export type IncomingRealtimeEvent = z.infer<typeof incomingRealtimeEvent>;
export type OutgoingRealtimeEvent = z.infer<typeof outgoingRealtimeEvent>;

export const parseFunctionArguments = <T>(schema: z.ZodSchema<T>, argumentsString: string): T => {
    try {
        const parsed = JSON.parse(argumentsString);
        return schema.parse(parsed);
    } catch (error) {
        throw new Error(`Invalid function arguments: ${error}`);
    }
};
