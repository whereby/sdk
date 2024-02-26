import getConstraints, { getMediaConstraints } from "../../src/webrtc/mediaConstraints";

// the selectGetConstraintsOptions is testing most permutations of this
describe("getConstraints", () => {
    const vdev1 = { kind: "videoinput", deviceId: "vdev1" };

    it("should not request audio if it is false", () => {
        const adev1 = { kind: "audioinput", deviceId: "adev1" };

        const result = getConstraints({
            devices: [vdev1, adev1],
            videoId: "v",
            audioId: false,
        });

        expect(result).toEqual({ video: expect.any(Object) });
    });
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
});
