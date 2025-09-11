import "@whereby.com/assistant-sdk/polyfills";
import { Trigger, TRIGGER_EVENT_SUCCESS, AUDIO_STREAM_READY, Assistant } from "@whereby.com/assistant-sdk";
import * as dotenv from "dotenv";

dotenv.config();

let hasJoinedRoom = false;

function main() {
    const trigger = new Trigger({
        webhookTriggers: {
            "room.client.joined": () => !hasJoinedRoom,
        },
        port: 3000,
    });

    trigger.start();

    trigger.on(TRIGGER_EVENT_SUCCESS, async ({ roomUrl }) => {
        const assistant = new Assistant({
            assistantKey: process.env.ASSISTANT_KEY || "",
            startCombinedAudioStream: true,
            startLocalMedia: false,
        });
        await assistant.joinRoom(roomUrl);

        hasJoinedRoom = true;

        assistant.on(AUDIO_STREAM_READY, ({ track }) => {
            assistant.sendChatMessage("Hello! I am your AI assistant. How can I help you today?");
        });
    });
}

main();
