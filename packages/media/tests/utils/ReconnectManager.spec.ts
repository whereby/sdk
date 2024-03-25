const EventEmitter = require("events");
const { ReconnectManager } = require("../../src/utils/ReconnectManager");
import { setTimeout as sleep } from "timers/promises";
import { PROTOCOL_EVENTS, PROTOCOL_RESPONSES } from "../../src/model/protocol";
import { getUpdatedStats } from "../../src/webrtc/stats/StatsMonitor/index";

jest.mock("../../src/webrtc/stats/StatsMonitor/index", () => ({
    __esModule: true,
    getUpdatedStats: jest.fn(),
}));

const mockGetUpdatedStats = getUpdatedStats as jest.Mock;

class MockSocket extends EventEmitter {}

const createClient = (
    id = "id",
    deviceId = "id",
    streams = ["0"],
    isAudioEnabled = false,
    isVideoEnabled = false,
    isPendingToLeave = false
) => {
    return {
        id,
        deviceId,
        isAudioEnabled,
        isVideoEnabled,
        streams,
        isPendingToLeave,
    };
};

const createMockSocket = () => {
    return new MockSocket();
};

jest.mock("../../src/webrtc/stats/StatsMonitor/index");

const DISCONNECT_TIMEOUT = 1500; // actual value configured on server-side.
const mockStatsMediaActive = {
    tracks: {
        probator: {},
        0: {
            ssrcs: {
                0: { bitrate: 150 },
                1: { bitrate: 100 },
            },
        },
    },
};

const mockStatsMediaNotActive = {
    tracks: {
        probator: {},
        0: {
            ssrcs: {
                0: { bitrate: 0 },
                1: { bitrate: 0 },
            },
        },
    },
};

describe("ReconnectManager", () => {
    it("should store disconnect time", () => {
        const socket = createMockSocket();
        const sut = new ReconnectManager(socket);

        socket.emit("disconnect");

        expect(typeof sut._signalDisconnectTime).toBe("number");
    });

    describe("events", () => {
        it("should not throw on error in payload", async () => {
            const socket = createMockSocket();
            const sut = new ReconnectManager(socket);
            const forwardEvent = jest.spyOn(sut, "emit");
            mockGetUpdatedStats.mockResolvedValue({});
            const payload = {
                error: {},
                disconnectTimeout: DISCONNECT_TIMEOUT,
            };

            expect(async () => {
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);
            }).not.toThrow();

            expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
            expect(forwardEvent.mock.calls[0][1]).toBe(payload);
        });

        describe(PROTOCOL_RESPONSES.ROOM_JOINED, () => {
            it("should not try glitchfree when disconnect timeout is exceeded", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const mockRtcManager = {
                    hasClient: () => true,
                };
                sut.rtcManager = mockRtcManager;
                const forwardEvent: any = jest.spyOn(sut, "emit");
                mockGetUpdatedStats.mockResolvedValue({});
                const selfClient = createClient();
                const remoteClient = createClient("id2", "id2");
                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, {
                    client: remoteClient,
                });
                sut._signalDisconnectTime = Date.now() - DISCONNECT_TIMEOUT;

                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    selfId: selfClient.id,
                    room: {
                        clients: [selfClient, remoteClient],
                    },
                    disconnectTimeout: DISCONNECT_TIMEOUT,
                });

                expect(getUpdatedStats).not.toHaveBeenCalled();
                expect(forwardEvent).toHaveBeenCalledTimes(2);
                expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                forwardEvent.mock.calls[1][1].room.clients.forEach((c: any) => {
                    expect(c.mergeWithOldClientState).toBeFalsy();
                });
            });

            it("should not call getStats on page reload or first join", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const selfClient = createClient();
                const remoteClient = createClient("id2", "id2");

                // A first room_joined or a page reload since not following a disconnect
                const payload = {
                    selfId: selfClient.id,
                    room: {
                        clients: [selfClient, remoteClient],
                    },
                };
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);

                expect(getUpdatedStats).not.toHaveBeenCalled();
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1]).toBe(payload);
            });

            it.each([
                [true, true],
                [false, undefined],
            ])("rtcManager is aware of client: %s, should merge client state: %s", async (hasClient, shouldMerge) => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent: any = jest.spyOn(sut, "emit");
                const selfClient = createClient();
                const remoteClient = createClient("id2", "id2");
                mockGetUpdatedStats.mockResolvedValue({});
                const mockRtcManager = {
                    hasClient: () => hasClient,
                };
                sut.rtcManager = mockRtcManager;
                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, {
                    client: remoteClient,
                });
                socket.emit("disconnect");
                const payload = {
                    selfId: selfClient.id,
                    room: {
                        clients: [selfClient, remoteClient],
                    },
                };

                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);

                expect(forwardEvent).toHaveBeenCalledTimes(2);
                expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[1][1].room.clients[1].mergeWithOldClientState).toBe(shouldMerge);
            });

            it.each([
                [false, false, false, false, false, false, true],
                [false, true, false, false, true, false, true],
                [true, true, false, true, true, false, true],
                [true, true, true, true, true, true, true],
                [false, false, true, false, false, false, undefined],
                [true, false, true, false, false, true, undefined],
                [false, true, false, false, true, true, undefined],
                [true, false, false, false, false, false, undefined],
                [true, false, false, true, true, false, undefined],
            ])(
                "state: audio: %s, video: %s, screenshare: %s. change: audio: %s, video: %s, screenshare: %s. mergeWithCurrentClientState should be %s",
                async (
                    isAudioEnabled,
                    isVideoEnabled,
                    isScreenshareEnabled,
                    audioChange,
                    videoChange,
                    screenshareChange,
                    shouldMerge
                ) => {
                    const socket = createMockSocket();
                    const sut = new ReconnectManager(socket);
                    const forwardEvent: any = jest.spyOn(sut, "emit");
                    const selfClient = {
                        id: "selfId",
                        deviceId: "id",
                    };
                    const remoteClient = {
                        id: "id",
                        streams: isScreenshareEnabled ? ["0", "screenshareStreamid"] : ["0"],
                        isAudioEnabled,
                        isVideoEnabled,
                        isScreenshareEnabled,
                    };
                    await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: remoteClient });
                    mockGetUpdatedStats.mockResolvedValue({ id: mockStatsMediaActive });
                    sut._clients[remoteClient.id] = remoteClient;
                    const mockRtcManager = {
                        hasClient: () => true,
                    };
                    sut.rtcManager = mockRtcManager;
                    const remoteClientAfterReconnect = {
                        ...remoteClient,
                        isAudioEnabled: audioChange,
                        isVideoEnabled: videoChange,
                        isScreenshareEnabled: screenshareChange,
                        streams: screenshareChange ? ["0", "screenshareStreamid"] : ["0"],
                    };
                    const payload = {
                        selfId: "selfId",
                        room: {
                            clients: [selfClient, remoteClientAfterReconnect],
                        },
                    };

                    socket.emit("disconnect");
                    await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);

                    expect(forwardEvent).toHaveBeenCalledTimes(2);
                    expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                    expect(forwardEvent.mock.calls[1][1].room.clients[1].mergeWithOldClientState).toBe(shouldMerge);
                }
            );

            it.each([
                ["try glitchfree on active media", { id: mockStatsMediaActive }, true, true],
                [
                    "try glitchfree on inactive media if client was not sending",
                    { id: mockStatsMediaNotActive },
                    false,
                    true,
                ],
                ["try glitchfree on missing media stats if client was not sending", { bogus: {} }, false, true],
                [
                    "not try glitchfree on inactive media if client was sending",
                    { id: mockStatsMediaNotActive },
                    true,
                    undefined,
                ],
                ["not try glitchfree on missing media stats if client was sending", { bogus: {} }, true, undefined],
            ])("should %s", async (testCase, mockStats, isVideoEnabled, shouldMerge) => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent: any = jest.spyOn(sut, "emit");
                const selfClient = createClient("selfId", "selfId");
                const remoteClient = createClient("id", "id", ["0"], isVideoEnabled);
                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: remoteClient });
                mockGetUpdatedStats.mockResolvedValue(mockStats);
                const mockRtcManager = {
                    hasClient: () => true,
                };
                sut.rtcManager = mockRtcManager;
                const payload = {
                    selfId: selfClient.id,
                    room: {
                        selfId: selfClient.id,
                        clients: [selfClient, remoteClient],
                    },
                };

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);

                expect(forwardEvent).toHaveBeenCalledTimes(2);
                expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[1][1].room.clients[1].mergeWithOldClientState).toBe(shouldMerge);
            });

            it("should abort glitchfree on errors", async () => {
                jest.spyOn(console, "error").mockImplementation(jest.fn());
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent: any = jest.spyOn(sut, "emit");
                const mockRtcManager = {
                    hasClient: () => {
                        throw new Error("Error in rtcManager");
                    },
                };
                sut.rtcManager = mockRtcManager;
                const selfClient = createClient();
                const remoteClient = createClient("id2", "id2");
                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: remoteClient });
                const payload = {
                    selfId: selfClient.id,
                    room: {
                        clients: [selfClient, remoteClient, { ...selfClient, id: "otherId", isPendingToLeave: true }],
                    },
                };

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, payload);

                expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent).toHaveBeenCalledTimes(2);
                expect(forwardEvent.mock.calls[1][1].room.clients.length).toBe(2);
                forwardEvent.mock.calls[1][1].room.clients.forEach((c: any) => {
                    expect(c.mergeWithOldClientState).toBeUndefined();
                });
            });
        });

        describe(PROTOCOL_RESPONSES.NEW_CLIENT, () => {
            it("should forward client reconnectmanager doesn't know about", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const remoteClient = createClient();

                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: remoteClient });

                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.NEW_CLIENT);
                expect(forwardEvent.mock.calls[0][1]).toEqual({ client: remoteClient });
            });

            it("should emit client_left for pending returning client", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const remoteClient = createClient();
                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: remoteClient });
                await socket.emit(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, { clientId: remoteClient.id });

                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: { ...remoteClient, id: "newId" } });

                expect(forwardEvent).toHaveBeenCalledTimes(3);
                expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.CLIENT_LEFT);
                expect(forwardEvent.mock.calls[2][0]).toBe(PROTOCOL_RESPONSES.NEW_CLIENT);
            });
        });

        describe(PROTOCOL_RESPONSES.CLIENT_LEFT, () => {
            it("should forward event and rtcManager.disconnect()", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const remoteClient = createClient();
                const mockRtcManager = { disconnect: jest.fn() };
                sut.rtcManager = mockRtcManager;

                await socket.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, { clientId: remoteClient.id, eventClaim: "claim" });

                expect(mockRtcManager.disconnect).toHaveBeenCalledWith(remoteClient.id, null, "claim");
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.CLIENT_LEFT);
            });
        });

        describe(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, () => {
            it.each([
                [
                    "not send client_left if media is active for sending client",
                    true,
                    { id: mockStatsMediaActive },
                    1,
                    false,
                ],
                [
                    "send client_left if media stopped for sending client",
                    true,
                    { id: mockStatsMediaNotActive },
                    2,
                    true,
                ],
                [
                    "not send client_left if client wasn't sending media",
                    false,
                    { id: mockStatsMediaNotActive },
                    1,
                    false,
                ],
            ])("should %s", async (testCase, isVideoEnabled, mockStats, forwardLength, expectingClientLeft) => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const mockRtcManager = { disconnect: jest.fn() };
                sut.rtcManager = mockRtcManager;
                mockGetUpdatedStats.mockResolvedValue(mockStats);
                const remoteClient = createClient("id", "id", ["0"], isVideoEnabled);
                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: remoteClient });

                await socket.emit(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, { clientId: remoteClient.id });
                await sleep(1);

                expect(forwardEvent).toHaveBeenCalledTimes(forwardLength);
                if (expectingClientLeft) {
                    expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.CLIENT_LEFT);
                }
            });
        });
    });
});
