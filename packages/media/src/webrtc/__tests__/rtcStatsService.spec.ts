import { mockWebSocketConstructor, randomString } from "../../../tests/webrtc/webRtcHelpers";
import { RtcStatsConnection } from "../rtcStatsService";
import rtcstats from "rtcstats";

jest.mock("rtcstats");

describe("rtcStatsService", () => {
    describe("rtcStats connection", () => {
        const MOCK_DATE = new Date();
        const baseUrl = "wss://rtcstats.test";
        const roomName = "/some-room";

        let resetDelta: jest.Func;
        let rtcStatsConnection: RtcStatsConnection;
        let originalLocation: typeof window.location;
        let originalWebSocket: typeof window.WebSocket;
        let WebSocketConstructor: ReturnType<typeof mockWebSocketConstructor>;

        function currentWebSocket() {
            const current = WebSocketConstructor.mock.instances.at(-1);

            if (!current) {
                throw new Error("No websocket found!");
            }
            return current;
        }

        function rtcStatsConnected() {
            const webSocket = currentWebSocket();

            // @ts-ignore
            webSocket.readyState = WebSocket.OPEN;
            webSocket.onopen?.(new Event("opened"));
        }

        function rtcStatsDisconnected() {
            const webSocket = currentWebSocket();

            // @ts-ignore
            webSocket.readyState = WebSocket.CLOSED;
            webSocket.onclose?.(new CloseEvent("closed"));
        }

        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(MOCK_DATE);

            resetDelta = jest.fn();
            jest.mocked(rtcstats).mockReturnValue({ resetDelta });

            rtcStatsConnection = new RtcStatsConnection({ url: baseUrl, getStatsBufferSize: 2 });

            // Replace global location object with mock
            originalLocation = window.location;
            const mockLocation = {
                ...originalLocation,
                pathname: roomName,
            };

            Object.defineProperty(window, "location", {
                configurable: true,
                value: mockLocation,
                writable: true,
            });

            // Replace WebSocket class with mock
            originalWebSocket = window.WebSocket;
            WebSocketConstructor = mockWebSocketConstructor();
            Object.defineProperty(window, "WebSocket", {
                configurable: true,
                value: WebSocketConstructor,
                writable: true,
            });
        });

        afterEach(() => {
            jest.useRealTimers();

            // Restore original location
            Object.defineProperty(window, "location", {
                configurable: true,
                value: originalLocation,
                writable: true,
            });

            // Restore original WebSocket
            Object.defineProperty(window, "WebSocket", {
                configurable: true,
                value: originalWebSocket,
                writable: true,
            });
        });

        it("should initially have clientInfo with connectionNumber 0", () => {
            expect(rtcStatsConnection.clientInfo.connectionNumber).toEqual(0);
        });

        it("should set up to trace getstats every 10 seconds", () => {
            expect(rtcstats).toHaveBeenCalledWith(rtcStatsConnection.server.trace, 10000, [""]);
        });

        describe("initial connection", () => {
            it("should create websocket with correct url and protocol", () => {
                rtcStatsConnection.server.connect();

                expect(WebSocket).toHaveBeenCalledWith(baseUrl + roomName, "1.0");
            });

            it("should send clientInfo once connected", () => {
                rtcStatsConnection.server.connect();
                rtcStatsConnected();

                expect(rtcStatsConnection.clientInfo.connectionNumber).toEqual(1);
                expect(currentWebSocket().send).toHaveBeenCalledWith(
                    JSON.stringify(["clientInfo", null, rtcStatsConnection.clientInfo]),
                );
            });

            it("should send buffered events once connected", () => {
                const preConnectEvents = [
                    { event: ["customEvent", null, { type: "test", value: randomString() }], buffered: true },
                    { event: ["customEvent", null, { type: "organizationId", value: randomString() }], buffered: true },
                    { event: ["some", "this"], buffered: true },
                    // insightsStats should not be buffered
                    { event: ["customEvent", null, { type: "insightsStats", value: randomString() }], buffered: false },
                    { event: ["getstats", randomString()], buffered: true },
                    { event: ["getstats", randomString()], buffered: true },
                    // we have set a getStats buffer of 2, the third one should be ignored
                    { event: ["getstats", randomString()], buffered: false },
                ];
                preConnectEvents.forEach(({ event }) => rtcStatsConnection.server.trace(...event));

                rtcStatsConnection.server.connect();
                rtcStatsConnected();

                preConnectEvents.forEach(({ event, buffered }) => {
                    const expectFn = buffered ? expect(currentWebSocket().send) : expect(currentWebSocket().send).not;
                    expectFn.toHaveBeenCalledWith(JSON.stringify([...event, MOCK_DATE.getTime()]));
                });
            });
        });

        describe("when connected", () => {
            beforeEach(() => {
                rtcStatsConnection.server.connect();
                rtcStatsConnected();
            });

            it("sendEvent should send customEvent and value", () => {
                const type = randomString("customEventName");
                const value = randomString("customEventData");

                rtcStatsConnection.sendEvent(type, value);

                expect(currentWebSocket().send).toHaveBeenCalledWith(
                    JSON.stringify(["customEvent", null, { type, value }, MOCK_DATE.getTime()]),
                );
            });

            it("sendAudioMuted() should send correct payload", () => {
                const muted = true;

                rtcStatsConnection.sendAudioMuted(muted);

                expect(currentWebSocket().send).toHaveBeenCalledWith(
                    JSON.stringify([
                        "customEvent",
                        null,
                        { type: "audio_muted", value: { muted } },
                        MOCK_DATE.getTime(),
                    ]),
                );
            });

            it("sendVideoMuted() should send correct payload", () => {
                const muted = true;

                rtcStatsConnection.sendVideoMuted(muted);

                expect(currentWebSocket().send).toHaveBeenCalledWith(
                    JSON.stringify([
                        "customEvent",
                        null,
                        { type: "video_muted", value: { muted } },
                        MOCK_DATE.getTime(),
                    ]),
                );
            });

            describe("cached events", () => {
                it.each([
                    "clientId",
                    "organizationId",
                    "displayName",
                    "userRole",
                    "deviceId",
                    "roomProduct",
                    "roomMode",
                    "sfuServer",
                    "featureFlags",
                ])("should re-send %s on subsequenct connects", (eventType) => {
                    const value = randomString();
                    const expectedPayload = JSON.stringify([
                        "customEvent",
                        null,
                        { type: eventType, value },
                        MOCK_DATE.getTime(),
                    ]);

                    // Send once on the initial connection
                    rtcStatsConnection.sendEvent(eventType, value);

                    // Willingly close and re-open the connection
                    rtcStatsConnection.server.close();
                    rtcStatsDisconnected();
                    rtcStatsConnection.server.connect();
                    rtcStatsConnected();

                    // Verify the same message is sent on both connections
                    expect(WebSocketConstructor.mock.instances[0].send).toHaveBeenCalledWith(expectedPayload);
                    expect(WebSocketConstructor.mock.instances[1].send).toHaveBeenCalledWith(expectedPayload);
                });
            });

            it("should schedule opening new connection when dropped and send buffered events on re-open", () => {
                const bufferedType = randomString("bufferedType");
                const bufferedValue = randomString("bufferedValue");

                // Simulate connection drop
                rtcStatsDisconnected();

                // Send event while disconnected
                rtcStatsConnection.sendEvent(bufferedType, bufferedValue);

                // Wait for a second and simulate websocket connecting
                jest.advanceTimersByTime(1000);
                rtcStatsConnected();

                expect(WebSocketConstructor.mock.instances[0].close).toHaveBeenCalledTimes(1);
                expect(WebSocketConstructor.mock.instances[1].send).toHaveBeenCalledWith(
                    JSON.stringify([
                        "customEvent",
                        null,
                        { type: bufferedType, value: bufferedValue },
                        MOCK_DATE.getTime(),
                    ]),
                );
            });

            it("should close webSocket when disconnecting", () => {
                rtcStatsConnection.server.close();
                rtcStatsDisconnected();

                expect(currentWebSocket().close).toHaveBeenCalled();
            });

            it("should reset delta when disconnected", () => {
                rtcStatsConnection.server.close();
                rtcStatsDisconnected();

                expect(resetDelta).toHaveBeenCalled();
            });
        });
    });
});
