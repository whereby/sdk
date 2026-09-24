import "@whereby.com/assistant-sdk/polyfills";

import { test, expect } from "@playwright/test";
import { createTransientRoom, deleteTransientRoom, joinRoom } from "./utils/room";
import { Assistant } from "@whereby.com/assistant-sdk";

function getAssistantKey(): string {
    const key = process.env.ASSISTANT_KEY;
    if (!key) {
        throw new Error("ASSISTANT_KEY not set");
    }
    return key;
}

test.describe("when creating an assistant", () => {
    let meetingId: string;
    let roomUrl: string;
    let assistant: Assistant | undefined;
    let combinedAudioSink: ReturnType<Assistant["getCombinedAudioSink"]> = null;
    let unsubscribeCombinedAudio: (() => void) | undefined;
    const assistantKey = getAssistantKey();

    test.beforeAll(async () => {
        ({ meetingId, roomUrl } = await createTransientRoom({
            isLocked: false,
            roomMode: "normal",
        }));
    });

    test.afterEach(async () => {
        unsubscribeCombinedAudio?.();
        unsubscribeCombinedAudio = undefined;
        combinedAudioSink?.stop();
        combinedAudioSink = null;

        if (assistant) {
            assistant.getRoomConnection().leaveRoom();
            assistant.getRoomConnection().destroy();
        }
    });

    test.afterAll(async () => {
        await deleteTransientRoom(meetingId);
    });

    test("an assistant can join the room", async ({ page }) => {
        await joinRoom({ page, roomUrl });
        assistant = new Assistant({ assistantKey: assistantKey });
        await assistant.joinRoom(roomUrl);
        expect(assistant.getRoomConnection().getState().connectionStatus).toBe("connected");
    });

    test("an assistant receives audio from the combined audio sink", async ({ page }) => {
        await joinRoom({ page, roomUrl, withFakeAudioStream: true });
        assistant = new Assistant({ assistantKey: assistantKey });

        await assistant.joinRoom(roomUrl);

        combinedAudioSink = assistant.getCombinedAudioSink();
        expect(combinedAudioSink).not.toBeNull();

        // make sure there's some audio being received from the combined audio sink
        await new Promise<void>((resolve) => {
            unsubscribeCombinedAudio = combinedAudioSink!.subscribe(({ samples }) => {
                if (samples.some((sample) => sample !== 0)) {
                    resolve();
                }
            });
        });
    });
});
