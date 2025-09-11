import "@whereby.com/assistant-sdk/polyfills";
import { Trigger, ASSISTANT_JOIN_SUCCESS, AUDIO_STREAM_READY } from "@whereby.com/assistant-sdk";

let hasJoinedRoom = false;

function main() {
    const trigger = new Trigger({
        webhookTriggers: {
            "room.client.joined": () => !hasJoinedRoom,
        },
        port: 3000,
        assistantKey: process.env.ASSISTANT_KEY!,
        startCombinedAudioStream: true,
        startLocalMedia: false,
    });

    trigger.start();

    trigger.on(ASSISTANT_JOIN_SUCCESS, ({ assistant }) => {
        console.log("Assistant joined the room");
        hasJoinedRoom = true;
        assistant.on(AUDIO_STREAM_READY, ({ track }) => {
            assistant.sendChatMessage("Hello! I am your AI assistant. How can I help you today?");
        });
    });
}

main();
