jest.mock("@whereby.com/rtcstats", () => ({
    __esModule: true,
    default: jest.fn(() => ({ resetDelta: jest.fn() })),
}));
jest.mock("@whereby.com/webrtcapihealthcheck", () => ({
    getWebRtcApiHealth: jest.fn(() => ({})),
}));
jest.mock("webrtc-adapter", () => ({ __esModule: true, default: {} }));

const mockWebSocketConstructor = jest.fn();

class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;
    constructor(url: string, protocol: string) {
        mockWebSocketConstructor(url, protocol);
    }
    send = jest.fn();
    close = jest.fn();
}

describe("rtcStatsService", () => {
    const originalWebSocket = global.WebSocket;
    let rtcStats: typeof import("../../src/webrtc/rtcStatsService").default;

    beforeEach(() => {
        global.WebSocket = MockWebSocket as any;
        mockWebSocketConstructor.mockClear();
        jest.isolateModules(() => {
            rtcStats = require("../../src/webrtc/rtcStatsService").default;
        });
    });

    afterEach(() => {
        rtcStats.server.close();
        global.WebSocket = originalWebSocket;
    });

    it("connects with the page's path by default", () => {
        rtcStats.server.connect();

        expect(mockWebSocketConstructor).toHaveBeenCalledWith(
            `wss://rtcstats.srv.whereby.com${window.location.pathname}`,
            "1.0",
        );
    });

    it("connects with the room's path and origin when the room's URL is set", () => {
        rtcStats.setRoomUrl("https://acme.whereby.com:8443/team-standup");

        rtcStats.server.connect();

        expect(mockWebSocketConstructor).toHaveBeenCalledWith(
            "wss://rtcstats.srv.whereby.com/?roomUrl=https%3A%2F%2Facme.whereby.com%3A8443%2Fteam-standup",
            "1.0",
        );
    });

    it("doesn't connect without the room's URL when it's required", () => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
        rtcStats.requireRoomUrl();

        rtcStats.server.connect();

        expect(mockWebSocketConstructor).not.toHaveBeenCalled();
    });
});
