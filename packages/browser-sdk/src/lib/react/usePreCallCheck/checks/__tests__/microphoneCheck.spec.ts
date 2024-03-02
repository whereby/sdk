import { MicrophoneCheck } from "../microphoneCheck";

describe("microphoneCheck", () => {
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

    let microphoneCheck: MicrophoneCheck;

    beforeEach(() => {
        microphoneCheck = new MicrophoneCheck();
    });

    describe("run", () => {
        it("should call getUserMedia with audio:true", async () => {
            try {
                await microphoneCheck.run();
            } catch (error) {
                // noop
            }

            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: false, audio: true });
        });

        describe("when getUserMedia resolves with one audio track", () => {
            it("should stop audio track and remove it from the stream", async () => {
                const audioTrack = { stop: jest.fn() };
                const removeTrack = jest.fn();
                navigator.mediaDevices.getUserMedia.mockResolvedValue({
                    getAudioTracks: () => [audioTrack],
                    removeTrack,
                });

                await microphoneCheck.run();

                expect(audioTrack.stop).toHaveBeenCalled();
                expect(removeTrack).toHaveBeenCalledWith(audioTrack);
            });
        });

        describe("when getUserMedia rejects", () => {
            it("should reject", async () => {
                navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error("getUserMedia error"));

                await expect(microphoneCheck.run()).rejects.toThrow("getUserMedia error");
            });
        });
    });
});
