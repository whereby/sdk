import "@whereby.com/assistant-sdk/polyfills";
import {
    Trigger,
    TRIGGER_EVENT_SUCCESS,
    AUDIO_STREAM_READY,
    Assistant,
    ASSISTANT_LEFT_ROOM,
    ASSISTANT_JOINED_ROOM,
} from "@whereby.com/assistant-sdk";
import * as dotenv from "dotenv";
import { setupDataChannel } from "./data-channel";

dotenv.config();

let hasJoinedRoom = false;

function main() {
    const trigger = new Trigger({
        webhookTriggers: {
            "room.client.joined": () => !hasJoinedRoom,
        },
        port: 3000,
    });
    let audioTrack: MediaStreamTrack;

    trigger.start();

    trigger.on(TRIGGER_EVENT_SUCCESS, async ({ roomUrl }) => {
        console.log(`assistant joined room: ${roomUrl}`);
        const assistant = new Assistant({
            assistantKey: process.env.ASSISTANT_KEY || "",
            startCombinedAudioStream: true,
            startLocalMedia: true,
        });

        try {
            await assistant.joinRoom(roomUrl);
        } catch (e) {
            console.error("Failed to join room", { error: e });
            return;
        }

        assistant.on(ASSISTANT_JOINED_ROOM, ({ roomUrl }) => {
            console.log(`Assistant has joined the room: ${roomUrl}`);
            assistant.sendChatMessage("Hello! I am your AI assistant. How can I help you today?");
            hasJoinedRoom = true;
        });

        assistant.on(AUDIO_STREAM_READY, ({ track }) => {
            console.log("Audio stream is ready");
            audioTrack = track;
            setupDataChannel(assistant, track);
        });

        assistant.on(ASSISTANT_LEFT_ROOM, ({ roomUrl }) => {
            console.log(`Assistant has left the room: ${roomUrl}`);
            hasJoinedRoom = false;
        });
    });
}

main();
