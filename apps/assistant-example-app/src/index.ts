import "@whereby.com/assistant-sdk/polyfills";
import { Trigger, TRIGGER_EVENT_SUCCESS, Assistant, ASSISTANT_LEFT_ROOM } from "@whereby.com/assistant-sdk";
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
        });

        try {
            await assistant.joinRoom(roomUrl);
            hasJoinedRoom = true;
        } catch (error) {
            console.error("Failed to join room:", error);
            return;
        }

        assistant.getRoomConnection().sendChatMessage("Hello! I am your AI assistant. How can I help you today?");

        assistant.on(ASSISTANT_LEFT_ROOM, ({ roomUrl }) => {
            console.log(`Assistant has left the room: ${roomUrl}`);
            hasJoinedRoom = false;
        });
    });
}

main();
