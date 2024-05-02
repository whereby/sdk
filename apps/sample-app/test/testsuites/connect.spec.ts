import { test, expect } from "@playwright/test";
import { createTransientRoom, deleteTransientRoom, joinRoom } from "./utils/room";

test.describe("unlocked room", () => {
    let meetingId: string;
    let roomUrl: string;

    test.beforeAll(async () => {
        ({ meetingId, roomUrl } = await createTransientRoom({
            isLocked: false,
            roomMode: "normal",
        }));
    });

    test.afterAll(async () => {
        await deleteTransientRoom(meetingId);
    });

    test("join room => leave room => re-join room => re-leave room", async ({ page }) => {
        await joinRoom({ page, roomUrl });

        await page.click('[data-testid="leaveRoomBtn"]');
        await expect(page.locator("dd[data-testid='connectionStatus']")).toContainText("leaving");
        await expect(page.locator('[data-testid="joinRoomBtn"]')).toHaveCount(1);

        await page.click('[data-testid="joinRoomBtn"]');
        await expect(page.locator("dd[data-testid='connectionStatus']")).toContainText("connected");

        await page.click('[data-testid="leaveRoomBtn"]');
        await expect(page.locator("dd[data-testid='connectionStatus']")).toContainText("leaving");
        await expect(page.locator('[data-testid="joinRoomBtn"]')).toHaveCount(1);
    });
});
