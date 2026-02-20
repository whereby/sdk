const EventEmitter = require("events");
import {
    KeepAliveManager,
    DISCONNECT_DURATION_LIMIT_MS,
    SIGNAL_PING_INTERVAL,
    SIGNAL_PING_MAX_LATENCY,
} from "../../src/utils/KeepAliveManager";
import { ServerSocket } from "../../src/utils/ServerSocket";

class MockSocket extends EventEmitter {}

const createSocketIoEngine = () => ({
    disconnect: jest.fn(),
    engine: { readyState: "open", sendPacket: jest.fn() },
    opts: { transports: [] },
});

const createMockSocketIoSocket = () => {
    const mockSocket = new MockSocket();
    Object.assign(mockSocket, createSocketIoEngine());
    jest.spyOn(mockSocket, "on");
    jest.spyOn(mockSocket, "off");

    return mockSocket;
};

describe("KeepAliveManager", () => {
    let serverSocket: ServerSocket;
    let keepAliveManager: KeepAliveManager;

    beforeEach(() => {
        jest.useFakeTimers();

        const _socket = createMockSocketIoSocket();
        _socket.io = createMockSocketIoSocket();

        serverSocket = new ServerSocket(`http://localhost`);
        serverSocket._socket = _socket;

        keepAliveManager = new KeepAliveManager(serverSocket);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it("should call heartbeat function on connect", () => {
        const initialTimestamp = keepAliveManager.lastPingTimestamp;

        jest.advanceTimersByTime(1000);

        serverSocket._socket.emit("connect");

        const pingTimestamp = keepAliveManager.lastPingTimestamp;

        expect(pingTimestamp - initialTimestamp).toEqual(1000);
    });

    it("should call heartbeat function on ping", () => {
        const initialTimestamp = keepAliveManager.lastPingTimestamp;

        jest.advanceTimersByTime(1000);

        serverSocket._socket.io.emit("ping");

        const pingTimestamp = keepAliveManager.lastPingTimestamp;

        expect(pingTimestamp - initialTimestamp).toEqual(1000);
    });

    it("should test underlying socket if zero pings received after connect", () => {
        serverSocket._socket.emit("connect");

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY + 1);

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(1);
        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledWith("noop");
    });

    it("should test underlying socket on any missed ping", () => {
        serverSocket._socket.emit("connect");

        jest.advanceTimersByTime(SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY - 1);

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(0);

        serverSocket._socket.io.emit("ping");

        jest.advanceTimersByTime(SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY - 1);

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(0);

        serverSocket._socket.io.emit("ping");

        jest.advanceTimersByTime(SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY + 1);

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(1);
        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledWith("noop");
    });

    it("should not test underlying socket after socket is disconnected", () => {
        serverSocket._socket.emit("connect");

        jest.advanceTimersByTime(SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY - 1);

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(0);

        serverSocket._socket.io.emit("ping");

        jest.advanceTimersByTime(SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY - 1);

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(0);

        serverSocket._socket.emit("disconnect");

        jest.advanceTimersByTime(SIGNAL_PING_INTERVAL + SIGNAL_PING_MAX_LATENCY + 1);

        expect(serverSocket._socket.io.engine.sendPacket).toHaveBeenCalledTimes(0);
    });

    describe("disconnectDurationLimitExceeded", () => {
        describe("when enabled", () => {
            beforeEach(() => {
                keepAliveManager.enableDisconnectDurationLimit();
            });

            it("should set disconnectDurationLimitExceeded and trigger final socket disconnect", () => {
                expect(keepAliveManager.disconnectDurationLimitExceeded).toEqual(false);
                expect(serverSocket._socket.disconnect).toHaveBeenCalledTimes(0);

                jest.advanceTimersByTime(DISCONNECT_DURATION_LIMIT_MS + 1);

                serverSocket._socket.io.emit("reconnect_attempt");

                expect(keepAliveManager.disconnectDurationLimitExceeded).toEqual(true);
                expect(serverSocket._socket.disconnect).toHaveBeenCalledTimes(1);
            });
        });

        describe("when disabled", () => {
            it("should not set disconnectDurationLimitExceeded and not trigger final socket disconnect", () => {
                expect(keepAliveManager.disconnectDurationLimitExceeded).toEqual(false);
                expect(serverSocket._socket.disconnect).toHaveBeenCalledTimes(0);

                jest.advanceTimersByTime(DISCONNECT_DURATION_LIMIT_MS + 1);

                serverSocket._socket.io.emit("reconnect_attempt");

                expect(keepAliveManager.disconnectDurationLimitExceeded).toEqual(false);
                expect(serverSocket._socket.disconnect).toHaveBeenCalledTimes(0);
            });
        });
    });
});
