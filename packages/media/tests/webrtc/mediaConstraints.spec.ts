import { GetMediaConstraintsOptions } from "../../src";
import getConstraints, { getMediaConstraints } from "../../src/webrtc/mediaConstraints";
import * as helpers from "./webRtcHelpers";

const options: Omit<GetMediaConstraintsOptions, "preferredDeviceIds" | "audioWanted" | "videoWanted"> = {
    disableAEC: false,
    disableAGC: false,
    hd: false,
    lax: false,
    lowDataMode: false,
    simulcast: false,
    widescreen: false,
};

// the selectGetConstraintsOptions is testing most permutations of this
describe("getConstraints", () => {
    const vdev1 = helpers.createMockedInputDevice("videoinput");
    const adev1 = helpers.createMockedInputDevice("audioinput");

    it("should not request audio if it is false", () => {
        const result = getConstraints({
            devices: [vdev1, adev1],
            videoId: "v",
            audioId: false,
            options: {} as any,
        });

        expect(result).toEqual({ video: expect.any(Object) });
    });

    it.each([
        ["video", "id", false, [vdev1]],
        ["audio", false, "id", [adev1]],
    ])("should request %s if we have a device of right type", (mediaKind, videoId, audioId, devices) => {
        const result = getConstraints({
            devices,
            audioId,
            videoId,
            options,
        });

        const expected: any = {};
        expected[mediaKind] = expect.any(Object);
        expect(result).toEqual(expected);
    });

    it.each([
        ["video", "id", false, [adev1]],
        ["video", false, false, [adev1, vdev1]],
        ["audio", false, "id", [vdev1]],
        ["audio", false, false, [adev1, vdev1]],
    ])("should not request %s if device type is missing or if deviceId is false", (_, videoId, audioId, devices) => {
        const result = getConstraints({
            devices,
            audioId,
            videoId,
            options,
        });

        expect(result).toEqual({});
    });

    it("should respect type", () => {});
});

describe("getMediaConstraints", () => {
    describe("frameRate", () => {
        it.each`
            lowDataMode | simulcast | expected
            ${false}    | ${false}  | ${24}
            ${true}     | ${false}  | ${15}
            ${true}     | ${true}   | ${24}
        `(
            "should set frameRate to $expected if lowDataMode is $lowDataMode and simulcast is $simulcast",
            ({ lowDataMode, simulcast, expected }) => {
                const result = getMediaConstraints({
                    ...options,
                    lowDataMode,
                    simulcast,
                    videoWanted: true,
                    audioWanted: false,
                    preferredDeviceIds: {},
                });

                // @ts-ignore
                expect(result.video.frameRate).toBe(expected);
            },
        );
    });

    describe("lax", () => {
        it("lax should delete facingmode on missing deviceId for video", () => {
            const result = getMediaConstraints({
                ...options,
                videoWanted: true,
                audioWanted: false,
                preferredDeviceIds: {},
                lax: true,
            });

            expect(result.video).toEqual(expect.any(Object));
            // @ts-ignore
            expect(result.video.facingMode).toBeUndefined();
        });

        it("should set audio to true when preferred audioId is missing", () => {
            const result = getMediaConstraints({
                ...options,
                lax: true,
                preferredDeviceIds: {},
                audioWanted: true,
                videoWanted: false,
            });

            expect(result.audio).toBe(true);
        });

        it("should not set audio to true when preferred audioId is present", () => {
            const result = getMediaConstraints({
                ...options,
                lax: true,
                preferredDeviceIds: { audioId: { exact: "id" } },
                audioWanted: true,
                videoWanted: false,
            });

            expect(result.audio).toEqual(expect.any(Object));
        });
    });
});
