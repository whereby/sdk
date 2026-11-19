jest.mock("@whereby.com/rtcstats", () => ({
    __esModule: true,
    default: jest.fn(() => ({ resetDelta: jest.fn() })),
}));
jest.mock("@whereby.com/webrtcapihealthcheck", () => ({
    getWebRtcApiHealth: jest.fn(() => ({})),
}));
jest.mock("webrtc-adapter", () => ({ __esModule: true, default: {} }));

const mockWebSocketConstructor = jest.fn();
let sockets: MockWebSocket[] = [];

class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;
    onclose?: (e: Partial<CloseEvent>) => void;
    constructor(url: string, protocol: string) {
        mockWebSocketConstructor(url, protocol);
        sockets.push(this);
    }
    send = jest.fn();
    close = jest.fn();
    closedByServer(code: number, reason = "") {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.({ code, reason });
    }
}

describe("rtcStatsService", () => {
    const originalWebSocket = global.WebSocket;
    let rtcStats: typeof import("../../src/webrtc/rtcStatsService").default;

    beforeEach(() => {
        global.WebSocket = MockWebSocket as any;
        mockWebSocketConstructor.mockReset();
        sockets = [];
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

    describe("when the connection closes", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.spyOn(console, "info").mockImplementation(() => {});
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
        });

        const traceEvents = (count: number) => {
            for (let i = 0; i < count; i++) {
                rtcStats.server.trace("getstats", "PC_0", {});
            }
        };

        it("has one pending reconnect, however many events are traced while closed", () => {
            rtcStats.server.connect();
            sockets[0].closedByServer(1006);

            // the server closes every new socket at once
            mockWebSocketConstructor.mockImplementation(() => {
                setTimeout(() => sockets[sockets.length - 1].closedByServer(1006), 10);
            });
            for (let i = 0; i < 10; i++) {
                traceEvents(1);
                jest.advanceTimersByTime(100);
            }
            jest.advanceTimersByTime(1000);

            expect(sockets).toHaveLength(2);
        });

        it("doesn't reconnect after close", () => {
            rtcStats.server.connect();
            sockets[0].closedByServer(1006);
            traceEvents(1);

            rtcStats.server.close();
            jest.advanceTimersByTime(60000);

            expect(sockets).toHaveLength(1);
        });

        it("stops reconnecting and warns when the server rejects it", () => {
            const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
            rtcStats.server.connect();

            sockets[0].closedByServer(1008, "Invalid roomUrl");
            traceEvents(10);
            jest.advanceTimersByTime(60000);

            expect(warn).toHaveBeenCalledWith("[RTCSTATS] Rejected by the server: Invalid roomUrl");
            expect(sockets).toHaveLength(1);
        });

        it("connects again when asked after the server rejected it", () => {
            jest.spyOn(console, "warn").mockImplementation(() => {});
            rtcStats.server.connect();
            sockets[0].closedByServer(1008, "Invalid roomUrl");

            rtcStats.server.connect();

            expect(sockets).toHaveLength(2);
        });
    });
});
