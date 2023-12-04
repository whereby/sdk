import getConstraints from "../../src/webrtc/mediaConstraints";

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

    it("should set fps to 24 if fps24 is true", () => {
        const result = getConstraints({ devices: [vdev1], options: { fps24: true, hd: true } });

        expect(result).toEqual({
            video: {
                aspectRatio: 1.3333333333333333,
                facingMode: "user",
                frameRate: 24,
                height: { ideal: 720, min: 360 },
            },
        });
    });
});
