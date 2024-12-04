import { test, expect, ConsoleMessage } from "@playwright/test";
import { createTransientRoom, deleteTransientRoom, joinRoom, RoomMode } from "./utils/room";
import {
    countFrames,
    CountFramesFunction,
    getAudioTrackPropertiesFromHTMLVideoElement,
    makeFrameStatistics,
} from "./utils/media";

const roomModes: RoomMode[] = ["normal", "group"];

roomModes.forEach((roomMode) => {
    test.describe(`roomMode: ${roomMode}`, () => {
        let meetingId: string;
        let roomUrl: string;

        test.beforeAll(async () => {
            ({ meetingId, roomUrl } = await createTransientRoom({
                isLocked: false,
                roomMode,
            }));
        });

        test.afterAll(async () => {
            await deleteTransientRoom(meetingId);
        });

        test("gets remote participant's stream", async ({ page, browserName }) => {
            // skip in WebKit for normal mode.
            test.skip(
                browserName === "webkit" && roomMode === "normal",
                "WebKit has issues with fake streams in normal mode.",
            );

            const participant1 = page;
            const joinRoomPromise = joinRoom({ page, roomUrl, withFakeAudioStream: true });
            if (browserName === "webkit") {
                await new Promise<void>((resolve) => {
                    page.on("console", (msg: ConsoleMessage) => {
                        if (
                            msg.type() === "warning" &&
                            msg.text() ===
                                "PeerConnection::addTransceiver with encodings failed, retrying without encodings"
                        ) {
                            // Our custom Safari17 handler tries to fix an issue with the mediasoup-client Safari12 handler where
                            // provided video stream encodings are ignored. However, the Webkit browser Playwright uses doesn't like
                            // our provided encodings and throws a TypeError, implying it thinks they are malformed.
                            // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTransceiver#exceptions
                            //
                            // If they ever fix that, this check will fail and we can remove it.
                            resolve();
                        }
                    });
                });
            }
            await joinRoomPromise;

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            await expect(participant1.getByTestId("remoteParticipantVideo")).toHaveCount(1);
            await expect(participant2.getByTestId("remoteParticipantVideo")).toHaveCount(1);

            // 4 = HAVE_ENOUGH_DATA - It tells that there is enough data available to start playing.
            await expect(participant1.getByTestId("remoteParticipantVideo")).toHaveJSProperty("readyState", 4);
            await expect(participant2.getByTestId("remoteParticipantVideo")).toHaveJSProperty("readyState", 4);

            await expect(participant1.getByTestId("remoteParticipantVideo")).toHaveJSProperty("muted", false);

            // check audio track
            const participant2AudioTrackProperties = await participant2
                .getByTestId("remoteParticipantVideo")
                .evaluate(getAudioTrackPropertiesFromHTMLVideoElement);
            expect(participant2AudioTrackProperties).toHaveProperty("readyState", "live");
            expect(participant2AudioTrackProperties).toHaveProperty("kind", "audio");
            expect(participant2AudioTrackProperties).toHaveProperty("muted", false);
            expect(participant2AudioTrackProperties).toHaveProperty("enabled", true);
            await expect(participant2.getByTestId("remoteParticipantVideo")).toHaveJSProperty("muted", false);
        });

        test("video is not frozen", async ({ page, browserName }) => {
            test.skip(browserName === "webkit", "Webkit does not have an API to get video frame stats.");

            const participant1 = page;
            await joinRoom({ page, roomUrl });

            const participant2 = await page.context().newPage();
            await joinRoom({ page: participant2, roomUrl });

            // 4 = HAVE_ENOUGH_DATA - It tells that there is enough data available to start playing.
            await expect(participant1.getByTestId("remoteParticipantVideo")).toHaveJSProperty("readyState", 4);
            await expect(participant2.getByTestId("remoteParticipantVideo")).toHaveJSProperty("readyState", 4);

            const countFramesHandle = await page.evaluateHandle(`${countFrames}`);
            const participant1Samples = await participant1
                .getByTestId("remoteParticipantVideo")
                .evaluate((element: HTMLVideoElement, countFramesFn) => {
                    const countFrames = countFramesFn as CountFramesFunction;
                    // counts 10 samples in a 1000ms interval.
                    return countFrames(element, 1000, 10);
                }, countFramesHandle);
            const participant1FrameStatistics = makeFrameStatistics(participant1Samples);

            expect(participant1FrameStatistics.minFps).toBeGreaterThan(1);
        });
    });
});
