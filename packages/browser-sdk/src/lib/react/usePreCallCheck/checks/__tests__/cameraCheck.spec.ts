import { CameraCheck } from "../cameraCheck";

describe("cameraCheck", () => {
    let originalNavigator: Navigator;
    const navigator = {
        mediaDevices: {
            getUserMedia: jest.fn(),
        },
    };

    beforeAll(() => {
        originalNavigator = global.navigator;

        Object.defineProperty(global, "navigator", {
            value: navigator,
        });
    });

    afterAll(() => {
        Object.defineProperty(global, "navigator", {
            value: originalNavigator,
        });
    });

    let cameraCheck: CameraCheck;

    beforeEach(() => {
        cameraCheck = new CameraCheck();
    });

    describe("run", () => {
        it("should call getUserMedia with video:true", async () => {
            try {
                await cameraCheck.run();
            } catch (error) {
                // noop
            }

            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
        });

        describe("when getUserMedia resolves with one video track", () => {
            it("should stop video track and remove it from the stream", async () => {
                const videoTrack = { stop: jest.fn() };
                const removeTrack = jest.fn();
                navigator.mediaDevices.getUserMedia.mockResolvedValue({
                    getVideoTracks: () => [videoTrack],
                    removeTrack,
                });

                await cameraCheck.run();

                expect(videoTrack.stop).toHaveBeenCalled();
                expect(removeTrack).toHaveBeenCalledWith(videoTrack);
            });
        });

        describe("when getUserMedia rejects", () => {
            it("should reject", async () => {
                navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error("getUserMedia error"));

                await expect(cameraCheck.run()).rejects.toThrow("getUserMedia error");
            });
        });
    });
});
