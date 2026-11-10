const mockResetDelta = jest.fn();
jest.mock("@whereby.com/rtcstats", () => ({
    __esModule: true,
    default: jest.fn(() => ({ resetDelta: mockResetDelta })),
}));
jest.mock("@whereby.com/webrtcapihealthcheck", () => ({
    getWebRtcApiHealth: jest.fn(() => ({})),
}));
jest.mock("webrtc-adapter", () => ({ __esModule: true, default: {} }));

const mockWebSocketConstructor = jest.fn();
const mockWebSockets: MockWebSocket[] = [];

class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;
    onclose: ((e: { code: number }) => void) | null = null;
    onopen: (() => void) | null = null;
    constructor(url: string, protocol: string) {
        mockWebSocketConstructor(url, protocol);
        mockWebSockets.push(this);
    }
    send = jest.fn();
    close = jest.fn();
}

const openSocket = (socket: MockWebSocket) => {
    socket.readyState = MockWebSocket.OPEN;
    socket.onopen?.();
};

const sentCustomEvents = (socket: MockWebSocket) =>
    socket.send.mock.calls
        .map(([data]) => JSON.parse(data))
        .filter(([type]) => type === "customEvent")
        .map(([, , { type }]) => type);

describe("rtcStatsService", () => {
    const originalWebSocket = global.WebSocket;
    let rtcStats: typeof import("../../src/webrtc/rtcStatsService").default;

    beforeEach(() => {
        global.WebSocket = MockWebSocket as any;
        mockWebSocketConstructor.mockClear();
        mockResetDelta.mockClear();
        mockWebSockets.length = 0;
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
        rtcStats.setRoomUrl("https://acme.whereby.com:8443/team-standup?roomKey=secret");

        rtcStats.server.connect();

        expect(mockWebSocketConstructor).toHaveBeenCalledWith(
            "wss://rtcstats.srv.whereby.com/team-standup?roomOrigin=https%3A%2F%2Facme.whereby.com%3A8443",
            "1.0",
        );
    });

    it("connects with the page's path again when the room's URL is cleared", () => {
        rtcStats.setRoomUrl("https://acme.whereby.com/team-standup");
        rtcStats.setRoomUrl(null);

        rtcStats.server.connect();

        expect(mockWebSocketConstructor).toHaveBeenCalledWith(
            `wss://rtcstats.srv.whereby.com${window.location.pathname}`,
            "1.0",
        );
    });

    it("opens a new connection when connecting right after closing", () => {
        rtcStats.server.connect();
        rtcStats.server.close();

        expect(rtcStats.server.connected).toBe(false);

        rtcStats.server.connect();

        expect(mockWebSocketConstructor).toHaveBeenCalledTimes(2);
        expect(rtcStats.server.connected).toBe(true);
    });

    it("stays connected when a replaced socket closes", () => {
        rtcStats.server.connect();
        rtcStats.server.close();
        rtcStats.server.connect();

        mockWebSockets[0].onclose?.({ code: 1000 });

        expect(rtcStats.server.connected).toBe(true);
    });

    describe("events from before a reconnect", () => {
        const joinRoom = (roomUrl: string) => {
            rtcStats.setRoomUrl(roomUrl);
            rtcStats.server.connect();
            openSocket(mockWebSockets[mockWebSockets.length - 1]);
            rtcStats.sendEvent("organizationId", { organizationId: "org" });
            rtcStats.sendEvent("roomSessionId", { roomSessionId: roomUrl });
        };

        it("sends them again when reconnecting in the same room", () => {
            joinRoom("https://acme.whereby.com/a");
            rtcStats.server.close();

            rtcStats.server.connect();
            openSocket(mockWebSockets[1]);

            expect(sentCustomEvents(mockWebSockets[1])).toEqual(["organizationId", "roomSessionId"]);
        });

        it("doesn't send the previous room's events after the room's URL is replaced", () => {
            joinRoom("https://acme.whereby.com/a");
            rtcStats.server.close();
            rtcStats.setRoomUrl(null);

            rtcStats.setRoomUrl("https://acme.whereby.com/b");
            rtcStats.server.connect();
            openSocket(mockWebSockets[1]);

            expect(sentCustomEvents(mockWebSockets[1])).toEqual([]);
        });

        it("sends full getstats reports again after the room's URL is replaced", () => {
            rtcStats.setRoomUrl("https://acme.whereby.com/a");
            expect(mockResetDelta).not.toHaveBeenCalled();

            rtcStats.setRoomUrl(null);

            expect(mockResetDelta).toHaveBeenCalledTimes(1);
        });

        it("keeps events from before the first room's URL is set", () => {
            rtcStats.sendEvent("deviceId", { deviceId: "device" });

            rtcStats.setRoomUrl("https://acme.whereby.com/a");
            rtcStats.server.connect();
            openSocket(mockWebSockets[0]);

            expect(sentCustomEvents(mockWebSockets[0])).toEqual(["deviceId"]);
        });
    });
});
