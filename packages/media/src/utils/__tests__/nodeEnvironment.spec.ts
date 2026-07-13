/**
 * @jest-environment node
 */

describe("@whereby.com/media in a non-browser (Node) environment", () => {
    it("does not throw when imported", () => {
        expect(() => {
            require("../../index");
        }).not.toThrow();
    });

    it("exposes a server object with safe no-op defaults", () => {
        const { rtcStats } = require("../../index");

        expect(rtcStats.server.connected).toBe(false);
        expect(rtcStats.server.attemptedConnectedAtLeastOnce).toBe(false);
        expect(typeof rtcStats.server.trace).toBe("function");
        expect(typeof rtcStats.server.close).toBe("function");
        expect(typeof rtcStats.server.connect).toBe("function");
    });

    it("does not throw when sendEvent/sendAudioMuted/sendVideoMuted are called", () => {
        const { rtcStats } = require("../../index");

        expect(() => rtcStats.sendEvent("custom_event", { foo: "bar" })).not.toThrow();
        expect(() => rtcStats.sendAudioMuted(true)).not.toThrow();
        expect(() => rtcStats.sendVideoMuted(false)).not.toThrow();
    });
});
