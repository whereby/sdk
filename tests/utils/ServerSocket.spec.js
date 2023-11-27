import { PROTOCOL_RESPONSES } from "../../src/model/protocol";
import { ReconnectManager } from "../../src/utils/ReconnectManager";
import ServerSocket from "../../src/utils/ServerSocket";

jest.mock("../../src/utils/ReconnectManager");

describe("ServerSocket", () => {
    describe("on", () => {
        let serverSocket;

        beforeEach(() => {
            serverSocket = new ServerSocket("https://localhost");
            jest.spyOn(serverSocket._socket, "on");
            jest.spyOn(serverSocket._socket, "off");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should attach an event listener to the internal socket", () => {
            const eventName = "some event";
            const handler = jest.fn();

            serverSocket.on(eventName, handler);

            expect(serverSocket._socket.on).toHaveBeenCalledWith(eventName, handler);
        });

        it("should return a deregistering function", () => {
            const deregisterHandler = serverSocket.on("event", () => {});

            expect(deregisterHandler).toBeInstanceOf(Function);
        });

        it("should return a deregistering function which will remove the listener", () => {
            const eventName = "some event";
            const handler = jest.fn();

            const deregisterHandler = serverSocket.on(eventName, handler);
            deregisterHandler();

            expect(serverSocket._socket.off).toHaveBeenCalledWith(eventName, handler);
        });
    });

    describe("setRtcManager()", () => {
        it("should be noop() with glitchFree off", () => {
            const serverSocket = new ServerSocket("https://localhost");

            expect(() => serverSocket.setRtcManager()).not.toThrow();
        });

        it("should not have a reconnect manager", () => {
            const serverSocket = new ServerSocket("https://localhost");
            expect(serverSocket["_reconnectManager"]).toBeUndefined();
        });

        it("should accept an rtcManager with glitchfree on", () => {
            const serverSocket = new ServerSocket("https://localhost", null, true);
            const mockManager = jest.fn();

            serverSocket.setRtcManager(mockManager);

            expect(serverSocket._reconnectManager?.rtcManager).toBe(mockManager);
        });

        it("should not throw with glitchFree on and missing ReconnectManger", () => {
            const serverSocket = new ServerSocket("https://localhost", null, true);

            delete serverSocket._reconnectManager;

            expect(() => serverSocket.setRtcManager({})).not.toThrow();
        });
    });

    describe("glitchFree", () => {
        it("should have a ReconnectManager", () => {
            const serverSocket = new ServerSocket("https://localhost", null, true);

            expect(serverSocket._reconnectManager).toBeDefined();
            expect(serverSocket._reconnectManager).toBeInstanceOf(ReconnectManager);
        });

        it("should intercept correct events from socket", () => {
            const serverSocket = new ServerSocket("https://localhost", null, true);

            serverSocket.on(PROTOCOL_RESPONSES.CLIENT_LEFT, jest.fn());
            serverSocket.on(PROTOCOL_RESPONSES.ROOM_JOINED, jest.fn());
            serverSocket.on(PROTOCOL_RESPONSES.NEW_CLIENT, jest.fn());
            serverSocket.on("event not intercepted by reconnect manager", jest.fn());

            expect(serverSocket._reconnectManager?.on).toHaveBeenCalledTimes(3);
        });

        it("should not throw when intercepting events on missing reconnect manager", () => {
            const serverSocket = new ServerSocket("https://localhost", null, true);

            delete serverSocket._reconnectManager;

            expect(() => serverSocket.on(PROTOCOL_RESPONSES.CLIENT_LEFT, jest.fn())).not.toThrow();
            expect(() => serverSocket.on(PROTOCOL_RESPONSES.ROOM_JOINED, jest.fn())).not.toThrow();
            expect(() => serverSocket.on(PROTOCOL_RESPONSES.NEW_CLIENT, jest.fn())).not.toThrow();
            expect(() => serverSocket.on("event not intercepted by reconnect manager", jest.fn())).not.toThrow();
        });

        it("should return a deregestering function", () => {
            const serverSocket = new ServerSocket("https://localhost", null, true);
            const deregisterHandler = serverSocket.on(PROTOCOL_RESPONSES.CLIENT_LEFT, jest.fn());

            deregisterHandler();

            expect(serverSocket._reconnectManager?.removeListener).toHaveBeenCalledTimes(1);
        });
    });
});
