import getConstraints from "../../src/webrtc/mediaConstraints";

// the selectGetConstraintsOptions is testing most permutations of this
describe("getConstraints", () => {
    it("should not request audio if it is false", () => {
        const vdev1 = { kind: "videoinput", deviceId: "vdev1" };
        const adev1 = { kind: "audioinput", deviceId: "adev1" };

        const result = getConstraints({
            devices: [vdev1, adev1],
            videoId: "v",
            audioId: false,
        });

        expect(result).toEqual({ video: expect.any(Object) });
    });
});
