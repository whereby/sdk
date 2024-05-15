import { test, expect } from "@playwright/test";
import { createTransientRoom, deleteTransientRoom, joinRoom } from "./utils/room";

test.describe("notification events", () => {
    let meetingId: string;
    let roomUrl: string;
    let hostRoomUrl: string;

    test.beforeAll(async () => {
        ({ meetingId, roomUrl, hostRoomUrl } = await createTransientRoom({
            isLocked: false,
            roomMode: "normal",
        }));
    });

    test.afterAll(async () => {
        await deleteTransientRoom(meetingId);
    });

    test("host joins => guest joins => guest raises hand => host asks guest to speak => guest acks host request", async ({
        page,
    }) => {
        const host = page;
        await joinRoom({ page, roomUrl: hostRoomUrl });

        const guest = await page.context().newPage();
        await joinRoom({ page: guest, roomUrl });

        // guest raises hand
        await guest.click('[data-testid="toggleRaisedHandBtn"]');

        // host invites guest to speak
        await expect(host.getByTestId("askToSpeakBtn")).toHaveCount(1);
        await host.click('[data-testid="askToSpeakBtn"]');

        // guest accepts request to speak from host
        await expect(guest.getByTestId("unmuteMicrophoneBtn")).toHaveCount(1);
        await guest.click('[data-testid="unmuteMicrophoneBtn"]');
    });
});
