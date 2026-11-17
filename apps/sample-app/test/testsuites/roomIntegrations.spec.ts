import { test, expect, Page } from "@playwright/test";
import { createTransientRoom, deleteTransientRoom, joinRoom, RoomMode } from "./utils/room";

const roomModes: RoomMode[] = ["normal", "group"];

// Matches MIRO_ACCESS_LINK in the sample app.
const MIRO_ACCESS_LINK = "https://miro.com/app/live-embed/uXjVSdkE2eTest=/";

const startButtons = {
    youtube: "startYoutubeIntegrationBtn",
    miro: "startMiroIntegrationBtn",
};

function runningIntegration(page: Page, name: keyof typeof startButtons) {
    return page.locator(`[data-testid="runningRoomIntegration"][data-integration="${name}"]`);
}

async function startIntegration(page: Page, name: keyof typeof startButtons) {
    await expect(page.getByTestId("enabledRoomIntegrations")).toContainText(name);
    await page.getByTestId(startButtons[name]).click();
    await expect(runningIntegration(page, name)).toHaveCount(1);
}

roomModes.forEach((roomMode) => {
    test.describe(`roomMode: ${roomMode}`, () => {
        let meetingId: string;
        let roomUrl: string;

        test.beforeEach(async () => {
            ({ meetingId, roomUrl } = await createTransientRoom({
                isLocked: false,
                roomMode,
            }));
        });

        test.afterEach(async () => {
            await deleteTransientRoom(meetingId);
        });

        test("start and stop a YouTube integration", async ({ page }) => {
            const participant1 = page;
            await joinRoom({ page, roomUrl });

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            await startIntegration(participant1, "youtube");

            // participant1 is the presenter
            await expect(participant1.getByTestId("roomIntegrationName")).toHaveText("youtube");
            await expect(participant1.getByTestId("roomIntegrationPresenter")).toHaveText("you");
            await expect(participant1.getByTestId("roomIntegrationPlayerState")).toHaveText("playing");

            // participant2 sees the same session as a viewer
            await expect(participant2.getByTestId("runningRoomIntegration")).toHaveCount(1);
            await expect(participant2.getByTestId("roomIntegrationName")).toHaveText("youtube");
            await expect(participant2.getByTestId("roomIntegrationPresenter")).toHaveText("SDK boy");
            await expect(participant2.getByTestId("roomIntegrationPlayerState")).toHaveText("playing");

            await participant1.getByTestId("stopRoomIntegrationBtn").click();

            await expect(participant1.getByTestId("runningRoomIntegration")).toHaveCount(0);
            await expect(participant2.getByTestId("runningRoomIntegration")).toHaveCount(0);
            await expect(participant1.getByTestId("roomIntegrationsError")).toHaveText("N/A");
        });

        test("pause, seek and play are synced to other participants", async ({ page }) => {
            const participant1 = page;
            await joinRoom({ page, roomUrl });

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            await startIntegration(participant1, "youtube");
            await expect(participant2.getByTestId("runningRoomIntegration")).toHaveCount(1);
            await expect(participant2.getByTestId("roomIntegrationSeek")).toHaveText("0");

            // pause
            await participant1.getByTestId("pauseRoomIntegrationBtn").click();
            await expect(participant2.getByTestId("roomIntegrationPaused")).toHaveText("true");
            await expect(participant2.getByTestId("roomIntegrationPlayerState")).toHaveText("paused");

            // seek while paused
            await participant1.getByTestId("seekRoomIntegrationBtn").click();
            await expect(participant2.getByTestId("roomIntegrationSeek")).toHaveText("42");
            await expect(participant2.getByTestId("roomIntegrationPaused")).toHaveText("true");

            // play resumes from the seeked position
            await participant1.getByTestId("playRoomIntegrationBtn").click();
            await expect(participant2.getByTestId("roomIntegrationPaused")).toHaveText("false");
            await expect(participant2.getByTestId("roomIntegrationPlayerState")).toHaveText("playing");
            await expect(participant2.getByTestId("roomIntegrationSeek")).toHaveText("42");
        });

        test("a participant joining late gets the running integration and its current state", async ({ page }) => {
            const participant1 = page;
            await joinRoom({ page, roomUrl });

            await startIntegration(participant1, "youtube");
            await participant1.getByTestId("pauseRoomIntegrationBtn").click();
            await participant1.getByTestId("seekRoomIntegrationBtn").click();
            await expect(participant1.getByTestId("roomIntegrationSeek")).toHaveText("42");

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            await expect(participant2.getByTestId("runningRoomIntegration")).toHaveCount(1);
            await expect(participant2.getByTestId("roomIntegrationPaused")).toHaveText("true");
            await expect(participant2.getByTestId("roomIntegrationSeek")).toHaveText("42");
        });

        test("start and stop a Miro integration", async ({ page }) => {
            const participant1 = page;
            await joinRoom({ page, roomUrl });

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            await startIntegration(participant1, "miro");
            await expect(participant1.getByTestId("roomIntegrationPresenter")).toHaveText("you");

            // participant2 gets the board link to render, and can't stop someone else's share
            const miro = runningIntegration(participant2, "miro");
            await expect(miro).toHaveCount(1);
            await expect(miro.getByTestId("roomIntegrationPresenter")).toHaveText("SDK boy");
            await expect(miro.getByTestId("roomIntegrationShareUrl")).toHaveText(MIRO_ACCESS_LINK);
            await expect(miro.getByTestId("roomIntegrationAccessLink")).toHaveText(MIRO_ACCESS_LINK);
            await expect(miro.getByTestId("stopRoomIntegrationBtn")).toBeDisabled();

            await participant1.getByTestId("stopRoomIntegrationBtn").click();

            await expect(participant1.getByTestId("runningRoomIntegration")).toHaveCount(0);
            await expect(participant2.getByTestId("runningRoomIntegration")).toHaveCount(0);
        });

        test("a participant joining late gets a running Miro board", async ({ page }) => {
            const participant1 = page;
            await joinRoom({ page, roomUrl });

            await startIntegration(participant1, "miro");

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            const miro = runningIntegration(participant2, "miro");
            await expect(miro).toHaveCount(1);
            await expect(miro.getByTestId("roomIntegrationAccessLink")).toHaveText(MIRO_ACCESS_LINK);
        });

        test("YouTube and Miro run side by side without affecting each other", async ({ page }) => {
            const participant1 = page;
            await joinRoom({ page, roomUrl });

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            await startIntegration(participant1, "youtube");
            await startIntegration(participant1, "miro");
            await expect(participant2.getByTestId("runningRoomIntegration")).toHaveCount(2);

            // pausing YouTube leaves the Miro session alone
            await runningIntegration(participant1, "youtube").getByTestId("pauseRoomIntegrationBtn").click();
            await expect(runningIntegration(participant2, "youtube").getByTestId("roomIntegrationPaused")).toHaveText(
                "true",
            );
            await expect(runningIntegration(participant2, "miro").getByTestId("roomIntegrationAccessLink")).toHaveText(
                MIRO_ACCESS_LINK,
            );

            // stopping Miro leaves YouTube running, still paused
            await runningIntegration(participant1, "miro").getByTestId("stopRoomIntegrationBtn").click();
            await expect(runningIntegration(participant2, "miro")).toHaveCount(0);
            await expect(runningIntegration(participant2, "youtube")).toHaveCount(1);
            await expect(runningIntegration(participant2, "youtube").getByTestId("roomIntegrationPaused")).toHaveText(
                "true",
            );
        });
    });
});
