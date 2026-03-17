import { GetMediaConstraintsOptions } from "../../src";
import * as MediaDevices from "../../src/webrtc/MediaDevices";
import * as helpers from "./webRtcHelpers";

const GUM_ERRORS = {
    OVER_CONSTRAINED: "OverconstrainedError",
    NOT_ALLOWED: "NotAllowedError",
    NOT_FOUND: "NotFoundError",
    NOT_READABLE: "NotReadableError",
    ABORT: "AbortError",
};

class MockError extends Error {
    constraint: undefined | string;
    constructor(name: string, msg = "") {
        super(msg);
        this.name = name;
    }
}

const oldMediaDevices = global.navigator.mediaDevices;
afterEach(() => {
    // @ts-ignore
    global.navigator.mediaDevices = oldMediaDevices;
});

describe("buildDeviceList", () => {
    const adev1 = helpers.createMockedInputDevice("audioinput", helpers.randomString(), "label");
    const vdev1 = helpers.createMockedInputDevice("videoinput", helpers.randomString(), "");
    it("should return default on no devices", () => {
        const kind = "audioinput";
        const devices: MediaDeviceInfo[] = [];
        const busyDeviceIds: string[] = [];
        const result = MediaDevices.buildDeviceList({ busyDeviceIds, devices, kind });
        expect(result).toEqual([{ audioId: "", label: "Default" }]);
    });
    it("should mark device as busy", () => {
        const devices = [adev1];
        const busyDeviceIds = [adev1.deviceId];
        const result = MediaDevices.buildDeviceList({ busyDeviceIds, devices, kind: adev1.kind });
        expect(result).toEqual([{ audioId: adev1.deviceId, label: `(busy) ${adev1.label}`, busy: true }]);
    });
    it("should trim and use deviceId on missing label", () => {
        const devices = [vdev1];
        const busyDeviceIds: string[] = [];
        const result = MediaDevices.buildDeviceList({ busyDeviceIds, devices, kind: vdev1.kind });
        expect(result).toEqual([{ videoId: vdev1.deviceId, label: vdev1.deviceId.slice(0, 5), busy: false }]);
    });
});

describe("enumerate", () => {
    let devices: any;

    beforeEach(() => {
        devices = [];
        // @ts-ignore
        global.navigator.mediaDevices = {
            enumerateDevices: () => Promise.resolve(devices),
        };
    });

    it("should remove duplicates", async () => {
        devices = [
            { deviceId: "a", kind: "videoinput" },
            { deviceId: "a", kind: "videoinput" },
            { deviceId: "b", kind: "", label: "yo" },
            { deviceId: "a", kind: "audioinput" },
            { deviceId: "b", kind: "", label: "man" },
        ];

        const result = await MediaDevices.enumerate();

        expect(result).toEqual([
            { deviceId: "a", kind: "videoinput" },
            { deviceId: "b", kind: "", label: "yo" },
            { deviceId: "a", kind: "audioinput" },
        ]);
    });
});

describe("stopStreamTracks", () => {
    let vdev: any;
    let adev: any;
    let videoTrack: any;
    let audioTrack: any;
    let stream: any;

    beforeEach(() => {
        vdev = { kind: "videoinput", deviceId: "vdev" };
        adev = { kind: "audioinput", deviceId: "adev" };
        videoTrack = { kind: "video", stop: jest.fn(), getCapabilities: () => vdev };
        audioTrack = { kind: "audio", stop: jest.fn(), getCapabilities: () => adev };
        stream = helpers.createMockedMediaStream([videoTrack, audioTrack]);
    });

    it("should stop all tracks in the stream", () => {
        MediaDevices.stopStreamTracks(stream);

        expect(videoTrack.stop).toHaveBeenCalled();
        expect(audioTrack.stop).toHaveBeenCalled();
    });

    it("should only stop audio when only=audio", () => {
        MediaDevices.stopStreamTracks(stream, "audio");

        expect(videoTrack.stop).not.toHaveBeenCalled();
        expect(audioTrack.stop).toHaveBeenCalled();
    });
});

describe("getStream", () => {
    let vdev1: MediaDeviceInfo;
    let vdev2: MediaDeviceInfo;
    let adev1: MediaDeviceInfo;
    let adev2: MediaDeviceInfo;
    let videoTrack1: MediaStreamTrack;
    let videoTrack2: MediaStreamTrack;
    let audioTrack1: MediaStreamTrack;
    let audioTrack2: MediaStreamTrack;
    let devices: MediaDeviceInfo[];
    let stream: MediaStream;
    let options: Omit<GetMediaConstraintsOptions, "preferredDeviceIds" | "audioWanted" | "videoWanted">;

    beforeEach(() => {
        vdev1 = helpers.createMockedInputDevice("videoinput", "vdev1");
        vdev2 = helpers.createMockedInputDevice("videoinput", "vdev2");
        adev1 = helpers.createMockedInputDevice("audioinput", "adev1");
        adev2 = helpers.createMockedInputDevice("audioinput", "adev2");
        videoTrack1 = helpers.createMockedMediaStreamTrack({ id: "v1", kind: "video" });
        videoTrack2 = helpers.createMockedMediaStreamTrack({ id: "v2", kind: "video" });
        audioTrack1 = helpers.createMockedMediaStreamTrack({ id: "a1", kind: "audio" });
        audioTrack2 = helpers.createMockedMediaStreamTrack({ id: "a2", kind: "audio" });
        options = {
            disableAEC: false,
            disableAGC: false,
            hd: false,
            lax: false,
            lowDataMode: false,
            simulcast: false,
            widescreen: false,
        };
        devices = [vdev1, vdev2, adev1, adev2];
        stream = helpers.createMockedMediaStream([videoTrack1, audioTrack1]);
        stream.removeTrack = jest.fn();
        stream.addTrack = jest.fn();
        // @ts-ignore
        global.navigator.mediaDevices = {};
    });

    it("should stop all tracks in stream when switching", async () => {
        // @ts-ignore
        global.navigator.mediaDevices.getUserMedia = jest.fn(() => {
            return Promise.resolve(helpers.createMockedMediaStream([videoTrack1, audioTrack2]));
        });

        const promise = MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: adev2.deviceId,
                options,
            },
            { replaceStream: stream },
        );

        // the tracks are stopped before GUM (before the promise)
        expect(videoTrack1.stop).toHaveBeenCalled();
        expect(audioTrack1.stop).toHaveBeenCalled();
        await promise;
        expect(videoTrack1.stop).toHaveBeenCalledTimes(1);
        expect(audioTrack1.stop).toHaveBeenCalledTimes(1);
    });

    it("should NOT stop audio track in stream when switching only video", async () => {
        global.navigator.mediaDevices.getUserMedia = async () =>
            // @ts-ignore
            helpers.createMockedMediaStream([videoTrack1, audioTrack2]);

        await MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: false,
                options,
            },
            { replaceStream: stream },
        );

        expect(audioTrack1.stop).not.toHaveBeenCalled();
        expect(videoTrack1.stop).toHaveBeenCalled();
    });

    it("should NOT stop video track in stream when switching only audio", async () => {
        global.navigator.mediaDevices.getUserMedia = async () =>
            // @ts-ignore
            helpers.createMockedMediaStream([videoTrack1, audioTrack2]);

        await MediaDevices.getStream(
            {
                devices,
                videoId: false,
                audioId: adev1.deviceId,
                options,
            },
            { replaceStream: stream },
        );

        expect(audioTrack1.stop).toHaveBeenCalledTimes(1);
        expect(videoTrack1.stop).not.toHaveBeenCalled();
    });

    it("should reuse videoTrack if switching audio", async () => {
        // @ts-ignore
        global.navigator.mediaDevices.getUserMedia = jest.fn(() => {
            return Promise.resolve(helpers.createMockedMediaStream([videoTrack1, audioTrack2]));
        });

        const type = "exact";
        await MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: adev2.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        const c = expect.objectContaining;
        expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
            c({
                video: c({ deviceId: { [type]: vdev1.deviceId } }),
                audio: c({ deviceId: { [type]: adev2.deviceId } }),
            }),
        );
        expect(stream.removeTrack).toHaveBeenCalledWith(videoTrack1);
        expect(stream.removeTrack).toHaveBeenCalledWith(audioTrack1);
        expect(stream.addTrack).toHaveBeenCalledWith(videoTrack1);
        expect(stream.addTrack).toHaveBeenCalledWith(audioTrack2);
    });

    it("should reuse audioTrack if switching video", async () => {
        // @ts-ignore
        global.navigator.mediaDevices.getUserMedia = jest.fn(() => {
            return Promise.resolve(helpers.createMockedMediaStream([videoTrack2, audioTrack1]));
        });

        const type = "exact";
        await MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: adev1.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        const c = expect.objectContaining;
        expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
            c({
                video: c({ deviceId: { [type]: vdev2.deviceId } }),
                audio: c({ deviceId: { [type]: adev1.deviceId } }),
            }),
        );
        expect(stream.removeTrack).toHaveBeenCalledWith(videoTrack1);
        expect(stream.removeTrack).toHaveBeenCalledWith(audioTrack1);
        expect(stream.addTrack).toHaveBeenCalledWith(videoTrack2);
        expect(stream.addTrack).toHaveBeenCalledWith(audioTrack1);
    });

    it("should use audio=true in constraints on OverconstrainedError and only=audio", async () => {
        let called = false;
        const e = new MockError(GUM_ERRORS.OVER_CONSTRAINED);
        const mockGUM: any = jest.fn(() => {
            if (called) return Promise.resolve(helpers.createMockedMediaStream([videoTrack2, audioTrack1]));
            else {
                called = true;
                return Promise.reject(e);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                audioId: adev2.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.error).toBe(e);
        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[1][0].audio).toEqual(true);
    });

    it.each([["width"], ["height"]])(
        "should remove facingMode on OverconstrainedError.constraint = %s, when no deviceId was requested",
        async (constraint) => {
            let called = false;
            const e = new MockError(GUM_ERRORS.OVER_CONSTRAINED);
            e.constraint = constraint;
            const mockGUM: any = jest.fn(() => {
                if (called) return Promise.resolve(helpers.createMockedMediaStream([videoTrack2, audioTrack1]));
                else {
                    called = true;
                    return Promise.reject(e);
                }
            });
            global.navigator.mediaDevices.getUserMedia = mockGUM;
            const type = "exact";

            const result = await MediaDevices.getStream(
                {
                    devices,
                    videoId: true,
                    audioId: false,
                    type,
                    options,
                },
                { replaceStream: stream },
            );

            expect(result.error).toBe(e);
            expect(result.stream).toBeDefined();
            expect(mockGUM.mock.calls[0][0].video.facingMode).toBeDefined();
            expect(mockGUM.mock.calls[1][0].video.facingMode).toBeUndefined();
        },
    );

    it("should remove deviceId on OverconstrainedError.constraint = deviceid", async () => {
        let called = false;
        const e = new MockError(GUM_ERRORS.OVER_CONSTRAINED);
        e.constraint = "deviceId";
        const mockGUM: any = jest.fn(() => {
            if (called) return Promise.resolve(helpers.createMockedMediaStream([videoTrack2, audioTrack1]));
            else {
                called = true;
                return Promise.reject(e);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: adev2.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.error).toBe(e);
        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].video.deviceId).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio.deviceId).toBeDefined();
        expect(mockGUM.mock.calls[1][0].video.deviceId).toBeUndefined();
        expect(mockGUM.mock.calls[1][0].audio.deviceId).toBeUndefined();
    });

    it("should retry video and audio seperately on NotFoundError - audioTrack not found", async () => {
        let callCount = 0;
        const e = new MockError(GUM_ERRORS.NOT_FOUND);
        const mockGUM: any = jest.fn(() => {
            if (callCount === 1) return Promise.resolve(helpers.createMockedMediaStream([videoTrack1]));
            else {
                callCount++;
                return Promise.reject(e);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: adev2.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.error).toBe(e);
        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[0][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[1][0].audio).toBeUndefined();
        expect(mockGUM.mock.calls[1][0].video).toEqual(expect.any(Object));
    });
    it("should retry video and audio seperately on NotFoundError - videoTrack not found", async () => {
        let callCount = 0;
        const e = new MockError(GUM_ERRORS.NOT_FOUND);
        const mockGUM: any = jest.fn(() => {
            if (callCount === 2) return Promise.resolve(helpers.createMockedMediaStream([audioTrack1]));
            else {
                callCount++;
                return Promise.reject(e);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: adev2.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.error).toBe(e);
        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[0][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[1][0].audio).toBeUndefined();
        expect(mockGUM.mock.calls[1][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[2][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[2][0].video).toBeUndefined();
    });

    it("should retry video and audio seperately on NotAllowedError - audio not allowed", async () => {
        let callCount = 0;
        const e = new MockError(GUM_ERRORS.NOT_ALLOWED);
        const mockGUM: any = jest.fn(() => {
            if (callCount === 1) return Promise.resolve(helpers.createMockedMediaStream([videoTrack1]));
            else {
                callCount++;
                return Promise.reject(e);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: adev2.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.error).toBe(e);
        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[0][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[1][0].audio).toBeUndefined();
        expect(mockGUM.mock.calls[1][0].video).toEqual(expect.any(Object));
    });
    it("should retry video and audio seperately on NotAllowedError - video not allowed", async () => {
        let callCount = 0;
        const e = new MockError(GUM_ERRORS.NOT_ALLOWED);
        const mockGUM: any = jest.fn(() => {
            if (callCount === 2) return Promise.resolve(helpers.createMockedMediaStream([audioTrack1]));
            else {
                callCount++;
                return Promise.reject(e);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: adev2.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.error).toBe(e);
        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[0][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[1][0].audio).toBeUndefined(); // We re-request video only first
        expect(mockGUM.mock.calls[1][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[2][0].video).toBeUndefined(); // We re-request audio only second
        expect(mockGUM.mock.calls[2][0].audio).toEqual(expect.any(Object));
    });

    it("should obtain video only stream if GUM failed with null error because of audio", async () => {
        let callCount = 0;
        const mockGUM: any = jest.fn(() => {
            if (callCount === 1) return Promise.resolve(helpers.createMockedMediaStream([videoTrack1]));
            else {
                callCount++;
                return Promise.reject(null);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: adev1.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[0][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[1][0].audio).toBeUndefined(); // We re-request video only first
        expect(mockGUM.mock.calls[1][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls.length).toEqual(2);
    });

    it("should obtain audio only stream if GUM failed with null error because of video", async () => {
        let callCount = 0;
        const mockGUM: any = jest.fn(() => {
            if (callCount === 2) return Promise.resolve(helpers.createMockedMediaStream([audioTrack1]));
            else {
                callCount++;
                return Promise.reject(null);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        const result = await MediaDevices.getStream(
            {
                devices,
                videoId: vdev1.deviceId,
                audioId: adev1.deviceId,
                type,
                options,
            },
            { replaceStream: stream },
        );

        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[0][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[1][0].audio).toBeUndefined(); // We re-request video only first
        expect(mockGUM.mock.calls[1][0].video).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls[2][0].video).toBeUndefined(); // We re-request audio only second
        expect(mockGUM.mock.calls[2][0].audio).toEqual(expect.any(Object));
        expect(mockGUM.mock.calls.length).toEqual(3);
    });

    it("should throw if null error can't obtain a stream", async () => {
        const mockGUM: any = jest.fn(() => {
            return Promise.reject(null);
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";

        await expect(
            MediaDevices.getStream(
                {
                    devices,
                    videoId: vdev1.deviceId,
                    audioId: adev1.deviceId,
                    type,
                    options,
                },
                { replaceStream: stream },
            ),
        ).rejects.toThrow();
    });

    it("should stop tracks and retry with same constraints on NotAllowedError", async () => {
        let called = false;
        const e = new MockError(GUM_ERRORS.NOT_ALLOWED);
        const mockGUM: any = jest.fn(() => {
            if (called) return Promise.resolve(helpers.createMockedMediaStream([videoTrack2]));
            else {
                called = true;
                return Promise.reject(e);
            }
        });
        global.navigator.mediaDevices.getUserMedia = mockGUM;
        const type = "exact";
        const promise = MediaDevices.getStream(
            {
                devices,
                videoId: vdev2.deviceId,
                audioId: false,
                type,
                options,
            },
            { replaceStream: stream },
        );
        expect(videoTrack1.stop).not.toHaveBeenCalled();

        const result = await promise;

        expect(videoTrack1.stop).toHaveBeenCalled();
        expect(result.error).toBe(e);
        expect(result.stream).toBeDefined();
        expect(mockGUM.mock.calls[0]).toEqual(mockGUM.mock.calls[1]);
    });

    it.each([["audio"], ["video"]])(
        "should retry %s without constraints on NotReadableError + regex match on error message",
        async (mediaKindWithProblem) => {
            let callCount = 0;
            const e = new MockError(GUM_ERRORS.NOT_READABLE, mediaKindWithProblem);
            const mockGUM: any = jest.fn(() => {
                if (callCount === 2) return Promise.resolve(helpers.createMockedMediaStream([videoTrack2]));
                else {
                    callCount++;
                    return Promise.reject(e);
                }
            });
            global.navigator.mediaDevices.getUserMedia = mockGUM;
            const type = "exact";

            const result = await MediaDevices.getStream(
                {
                    devices,
                    videoId: vdev2.deviceId,
                    audioId: adev2.deviceId,
                    type,
                    options,
                },
                { replaceStream: stream },
            );

            expect(result.error).toBe(e);
            expect(result.stream).toBeDefined();
            expect(mockGUM.mock.calls.length).toBe(3);
            expect(mockGUM.mock.calls[1][0][mediaKindWithProblem].deviceId[type]).toBe(
                mediaKindWithProblem === "audio" ? adev2.deviceId : vdev2.deviceId,
            );
            expect(mockGUM.mock.calls[2][0][mediaKindWithProblem].deviceId).toBeUndefined();
        },
    );

    it.each([[GUM_ERRORS.NOT_READABLE], [GUM_ERRORS.ABORT]])(
        "should retry with lax constraints, without video and without audio on %s",
        async (errorName) => {
            const e = new MockError(errorName);
            let callCount = 0;
            const mockGUM: any = jest.fn(() => {
                if (callCount === 3) return Promise.resolve(helpers.createMockedMediaStream([videoTrack2]));
                else {
                    callCount++;
                    return Promise.reject(e);
                }
            });
            global.navigator.mediaDevices.getUserMedia = mockGUM;
            const type = "exact";

            const result = await MediaDevices.getStream(
                {
                    devices,
                    videoId: vdev2.deviceId,
                    audioId: adev2.deviceId,
                    type,
                    options,
                },
                { replaceStream: stream },
            );

            expect(result.error).toBe(e);
            expect(result.stream).toBeDefined();
            expect(mockGUM.mock.calls.length).toBe(4);
            expect(mockGUM.mock.calls[2][0].video).toBeUndefined();
            expect(mockGUM.mock.calls[3][0].audio).toBeUndefined();
        },
    );

    it.each([
        [GUM_ERRORS.NOT_READABLE],
        [GUM_ERRORS.ABORT],
        [GUM_ERRORS.NOT_ALLOWED],
        [GUM_ERRORS.NOT_FOUND],
        [GUM_ERRORS.OVER_CONSTRAINED],
    ])("should throw %s when fallbacks fail", async (errorName) => {
        const e = new MockError(errorName);
        global.navigator.mediaDevices.getUserMedia = jest.fn(() => {
            return Promise.reject(e);
        });
        const type = "exact";

        await expect(
            MediaDevices.getStream(
                {
                    devices,
                    videoId: vdev2.deviceId,
                    audioId: adev2.deviceId,
                    type,
                    options,
                },
                { replaceStream: stream },
            ),
        ).rejects.toThrow();
    });
});

describe("getUserMedia", () => {
    it("should throw on no devices", async () => {
        let err;

        try {
            await MediaDevices.getUserMedia({});
        } catch (e: any) {
            err = e;
        }

        return expect(err.name).toBe("nodevices");
    });

    it("should give constraints to real getUserMedia", () => {
        // @ts-ignore
        global.navigator.mediaDevices = { getUserMedia: jest.fn().mockResolvedValue() };
        const constraints = { audio: true };

        MediaDevices.getUserMedia(constraints);

        return expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(constraints);
    });
});

describe("getDeviceData", () => {
    it("empty stream", () => {
        const stream = helpers.createMockedMediaStream([]);

        const res = MediaDevices.getDeviceData({ stream } as any);

        expect(res).toEqual({ audio: { deviceId: undefined }, video: { deviceId: undefined } });
    });

    it("find videoId when only video", () => {
        const vtrack = helpers.createMockedMediaStreamTrack({ id: "videotrack", kind: "video" });

        const res = MediaDevices.getDeviceData({
            videoTrack: vtrack as any,
            devices: [],
        });

        expect(res).toEqual({
            audio: { deviceId: undefined },
            video: { deviceId: "videotrack", label: undefined },
        });
    });

    it("finds audioId when only audio", () => {
        const atrack = helpers.createMockedMediaStreamTrack({ id: "audiotrack", kind: "audio" });

        const res = MediaDevices.getDeviceData({
            audioTrack: atrack as any,
            devices: [],
        });

        expect(res).toEqual({
            audio: { deviceId: "audiotrack", label: undefined },
            video: { deviceId: undefined },
        });
    });

    it("find videoId when only audio and stoppedVideoTrack", () => {
        const atrack = helpers.createMockedMediaStreamTrack({ id: "audiotrack", kind: "audio" });
        const stopVtrack = helpers.createMockedMediaStreamTrack({ id: "stopVtrack", kind: "video" });

        const res = MediaDevices.getDeviceData({
            audioTrack: atrack as any,
            stoppedVideoTrack: stopVtrack as any,
            devices: [],
        });

        expect(res).toEqual({
            audio: { deviceId: "audiotrack", label: undefined },
            video: { deviceId: "stopVtrack", label: undefined },
        });
    });

    it("find videoId by vtrack.getSettings and audioId by atrack.label", () => {
        const stream = helpers.createMockedMediaStream();
        const vtrack = stream.getVideoTracks()[0];
        const atrack = stream.getAudioTracks()[0];

        const videoId = helpers.randomString("videoId");
        const audioId = helpers.randomString("audioId");
        vtrack.getSettings = () => ({ deviceId: videoId });
        // @ts-ignore
        delete atrack.getSettings;
        // @ts-ignore
        atrack.label = "My mic";
        // @ts-ignore
        vtrack.label = "My cam";
        const devices = [{ deviceId: audioId, kind: "audioinput", label: "My mic" }];

        const res = MediaDevices.getDeviceData({
            audioTrack: atrack,
            videoTrack: vtrack,
            devices: devices as any,
        });

        expect(res).toEqual({
            audio: { deviceId: audioId, label: "My mic" },
            video: { deviceId: videoId, label: "My cam" },
        });
    });

    it("finds deviceId through lastUsedId when track is missing", () => {
        const videoId = helpers.randomString("videoId");
        const audioId = helpers.randomString("audioId");
        const devices = [
            helpers.createMockedInputDevice("videoinput", videoId),
            helpers.createMockedInputDevice("audioinput", audioId),
        ];
        const res = MediaDevices.getDeviceData({
            devices,
            lastVideoId: videoId,
        });

        expect(res).toEqual({
            audio: { deviceId: undefined },
            video: { deviceId: videoId },
        });
    });
});

describe("compareLocalDevices", () => {
    const internalMic = { kind: "audioinput", deviceId: "internal-mic", label: "Internal mic" };
    const externalMic = { kind: "audioinput", deviceId: "external-mic", label: "USB mic" };
    const internalCam = { kind: "videoinput", deviceId: "internal-cam", label: "Internal cam" };
    const externalCam = { kind: "videoinput", deviceId: "external-cam", label: "USB cam" };
    const headPhones = { kind: "audiooutput", deviceId: "default", label: "Headphones" };

    const empty = { added: {}, removed: {}, changed: {} };

    it.each`
        before           | after                                                   | changes
        ${[]}            | ${[]}                                                   | ${{}}
        ${[internalMic]} | ${[]}                                                   | ${{ audioinput: { ...empty, removed: { [internalMic.deviceId]: internalMic } } }}
        ${[]}            | ${[internalMic]}                                        | ${{ audioinput: { ...empty, added: { [internalMic.deviceId]: internalMic } } }}
        ${[internalMic]} | ${[internalMic]}                                        | ${{ audioinput: empty }}
        ${[internalMic]} | ${[{ ...internalMic, label: "X" }]}                     | ${{ audioinput: { ...empty, changed: { [internalMic.deviceId]: { ...internalMic, label: "X" } } } }}
        ${[internalMic]} | ${[externalMic]}                                        | ${{ audioinput: { ...empty, added: { [externalMic.deviceId]: externalMic }, removed: { [internalMic.deviceId]: internalMic } } }}
        ${[internalMic]} | ${[internalMic, externalMic]}                           | ${{ audioinput: { ...empty, added: { [externalMic.deviceId]: externalMic } } }}
        ${[]}            | ${[internalMic, externalMic, internalCam, externalCam]} | ${{ audioinput: { ...empty, added: { [internalMic.deviceId]: internalMic, [externalMic.deviceId]: externalMic } }, videoinput: { ...empty, added: { [internalCam.deviceId]: internalCam, [externalCam.deviceId]: externalCam } } }}
        ${[]}            | ${[headPhones]}                                         | ${{ audiooutput: { ...empty, added: { [headPhones.deviceId]: headPhones } } }}
    `(
        `expect changes:$changes when
            before:$before,
            after:$after
    `,
        ({ before, after, changes }) => {
            const changesByKind = MediaDevices.compareLocalDevices(before, after);

            expect(changesByKind).toStrictEqual(changes);
        },
    );
});

describe("getUpdatedDevices", () => {
    const aId = helpers.randomString("audioid");
    const sId = helpers.randomString("speakerId");
    const vId = helpers.randomString("videoId");
    const aDevice = { kind: "audioinput", deviceId: aId, label: helpers.randomString("Internal mic") };
    const sDevice = { kind: "audiooutput", deviceId: sId, label: helpers.randomString("Internal speaker") };
    const vDevice = { kind: "videoinput", deviceId: vId, label: helpers.randomString("Internal cam") };
    const aId2 = helpers.randomString("audioid2");
    const sId2 = helpers.randomString("speakerId2");
    const vId2 = helpers.randomString("videoId2");
    const aDevice2 = { kind: "audioinput", deviceId: aId2, label: helpers.randomString("External mic") };
    const sDevice2 = { kind: "audiooutput", deviceId: sId2, label: helpers.randomString("Internal speaker") };
    const vDevice2 = { kind: "videoinput", deviceId: vId2, label: helpers.randomString("External cam") };

    it.each`
        oldDevices             | newDevices                        | currentAId   | currentVId   | currentSId   | expectedChanges
        ${[]}                  | ${[]}                             | ${undefined} | ${undefined} | ${undefined} | ${{ addedDevices: {}, changedDevices: {}, removedDevices: {} }}
        ${[]}                  | ${[aDevice, vDevice]}             | ${undefined} | ${undefined} | ${undefined} | ${{ addedDevices: { audioinput: aDevice, videoinput: vDevice }, changedDevices: {}, removedDevices: {} }}
        ${[aDevice]}           | ${[aDevice, aDevice2]}            | ${aId}       | ${undefined} | ${undefined} | ${{ addedDevices: { audioinput: aDevice2 }, changedDevices: {}, removedDevices: {} }}
        ${[aDevice]}           | ${[]}                             | ${aId}       | ${undefined} | ${undefined} | ${{ addedDevices: {}, changedDevices: { audioinput: {} }, removedDevices: { audioinput: aDevice } }}
        ${[aDevice]}           | ${[{ ...aDevice, label: "new" }]} | ${aId}       | ${undefined} | ${undefined} | ${{ addedDevices: {}, changedDevices: { audioinput: { deviceId: aDevice.deviceId } }, removedDevices: {} }}
        ${[aDevice, vDevice]}  | ${[aDevice2, vDevice2]}           | ${aId}       | ${vId}       | ${undefined} | ${{ addedDevices: { audioinput: aDevice2, videoinput: vDevice2 }, changedDevices: { audioinput: {}, videoinput: {} }, removedDevices: { audioinput: aDevice, videoinput: vDevice } }}
        ${[aDevice, vDevice]}  | ${[aDevice, vDevice, vDevice2]}   | ${aId}       | ${vId}       | ${undefined} | ${{ addedDevices: { videoinput: vDevice2 }, changedDevices: {}, removedDevices: {} }}
        ${[]}                  | ${[sDevice]}                      | ${undefined} | ${undefined} | ${undefined} | ${{ addedDevices: { audiooutput: sDevice }, changedDevices: {}, removedDevices: {} }}
        ${[sDevice, sDevice2]} | ${[sDevice2]}                     | ${undefined} | ${undefined} | ${sId}       | ${{ addedDevices: {}, changedDevices: { audiooutput: { deviceId: sDevice2.deviceId } }, removedDevices: { audiooutput: sDevice } }}
    `(
        `expect $expectedChanges when
            oldDevices:$oldDevices,
            newDevices:$newDevices,
            currentAudioId:$currentAId,
            currentVideoId:$currentVId
    `,
        ({ expectedChanges, oldDevices, newDevices, currentAId, currentVId, currentSId }) => {
            const updatedUserMediaConstraints = MediaDevices.getUpdatedDevices({
                oldDevices,
                newDevices,
                currentAudioId: currentAId,
                currentVideoId: currentVId,
                currentSpeakerId: currentSId,
            });

            expect(updatedUserMediaConstraints).toStrictEqual(expectedChanges);
        },
    );
});
