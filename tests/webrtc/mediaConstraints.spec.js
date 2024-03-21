import getConstraints, { getMediaConstraints } from "../../src/webrtc/mediaConstraints";

// the selectGetConstraintsOptions is testing most permutations of this
describe("getConstraints", () => {
    const vdev1 = { kind: "videoinput", deviceId: "vdev1" };
    const adev1 = { kind: "audioinput", deviceId: "adev1" };

    it("should not request audio if it is false", () => {
        const result = getConstraints({
            devices: [vdev1, adev1],
            videoId: "v",
            audioId: false,
        });

        expect(result).toEqual({ video: expect.any(Object) });
    });

    it.each([
        ["video", null, false, [vdev1]],
        ["audio", false, null, [adev1]],
    ])("should request %s if we have a device of right type", (mediaKind, videoId, audioId, devices) => {
        const result = getConstraints({
            devices,
            audioId,
            videoId,
        });

        const expected = {};
        expected[mediaKind] = expect.any(Object);
        expect(result).toEqual(expected);
    });

    it.each([
        ["video", null, false, [adev1]],
        ["video", false, false, [adev1, vdev1]],
        ["audio", false, null, [vdev1]],
        ["audio", false, false, [adev1, vdev1]],
    ])("should not request %s if device type is missing or if deviceId is false", (_, videoId, audioId, devices) => {
        const result = getConstraints({
            devices,
            audioId,
            videoId,
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
                const preferredDeviceIds = { audioId: "audioId", videoId: "videoId" };

                const result = getMediaConstraints({ lowDataMode, preferredDeviceIds, simulcast });

                expect(result.video.frameRate).toBe(expected);
            }
        );
    });

    describe("lax", () => {
        it("lax should delete facingmode on missing deviceId for video", () => {
            const result = getMediaConstraints({ preferredDeviceIds: {}, lax: true });

            expect(result.video).toEqual(expect.any(Object));
            expect(result.video.facingMode).toBeUndefined();
        });

        it("should set audio to true when audioId is missing", () => {
            const result = getMediaConstraints({ lax: true, preferredDeviceIds: {} });

            expect(result.audio).toBe(true);
        });

        it("should not set audio to true when audioId is present", () => {
            const result = getMediaConstraints({ lax: true, preferredDeviceIds: { audioId: "id" } });

            expect(result.audio).toEqual(expect.any(Object));
        });
    });
});
