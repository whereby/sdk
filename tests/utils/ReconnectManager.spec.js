const EventEmitter = require("events");
const { ReconnectManager } = require("../../src/utils/ReconnectManager");
import { setTimeout as sleep } from "timers/promises";
import { PROTOCOL_EVENTS, PROTOCOL_RESPONSES } from "../../src/model/protocol";
import { getUpdatedStats } from "../../src/webrtc/stats/StatsMonitor/index";

class MockSocket extends EventEmitter {}

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

    it.each([
        [PROTOCOL_RESPONSES.AUDIO_ENABLED, "isAudioEnabled", false, true],
        [PROTOCOL_RESPONSES.AUDIO_ENABLED, "isAudioEnabled", true, false],
        [PROTOCOL_RESPONSES.VIDEO_ENABLED, "isVideoEnabled", false, true],
        [PROTOCOL_RESPONSES.VIDEO_ENABLED, "isVideoEnabled", true, false],
    ])("should store %s in state", async (socketMessage, clientAttribute, initialValue, valueInMessage) => {
        const socket = createMockSocket();
        const sut = new ReconnectManager(socket);
        const client1 = {
            id: "id",
            streams: ["0", "screenshareStreamid"],
        };
        client1[clientAttribute] = initialValue;
        sut._clients[client1.id] = client1;

        const payload = { clientId: client1.id };
        payload[clientAttribute] = valueInMessage;

        await socket.emit(socketMessage, payload);

        expect(sut._clients[client1.id][clientAttribute]).toBe(valueInMessage);
    });

    it.each([
        [PROTOCOL_RESPONSES.SCREENSHARE_STARTED, false, true],
        [PROTOCOL_RESPONSES.SCREENSHARE_STOPPED, true, false],
    ])("should store %s in state", async (socketMessage, initialValue, valueInMessage) => {
        const socket = createMockSocket();
        const sut = new ReconnectManager(socket);
        const client1 = {
            id: "id",
            streams: ["0", "screenshareStreamid"],
            isScreenshareEnabled: initialValue,
        };
        sut._clients[client1.id] = client1;

        await socket.emit(socketMessage, { clientId: client1.id, isScreenshareEnabled: valueInMessage });

        expect(sut._clients[client1.id].isScreenshareEnabled).toBe(valueInMessage);
    });

    describe("events", () => {
        describe(PROTOCOL_RESPONSES.ROOM_JOINED, () => {
            it("should forward event when threshold is exceeded", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                getUpdatedStats.mockResolvedValue({});
                sut._signalDisconnectTime = Date.now() - (DISCONNECT_TIMEOUT + 1);

                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [],
                    },
                    disconnectTimeout: DISCONNECT_TIMEOUT,
                });

                expect(getUpdatedStats).not.toHaveBeenCalled();
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
            });

            it("should remove clients pending to leave event when threshold is exceeded", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", isPendingToLeave: true };
                getUpdatedStats.mockResolvedValue({});

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client1],
                    },
                });

                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([]);
            });

            it("should always ignore yourself", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", isPendingToLeave: true };
                getUpdatedStats.mockResolvedValue({});

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client1],
                    },
                    selfId: "id",
                });

                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client1]);
            });

            it("should add clients to reconnectmanager state on first connect", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", streams: [] };
                getUpdatedStats.mockResolvedValue({});
                expect(sut._clients).toEqual({});

                // A clean room_joined, not following a disconnect
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client1],
                    },
                });

                expect(Object.keys(sut._clients).length).toBe(1);
                expect(sut._clients[client1.id]).toBeTruthy();
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client1]);
            });

            it("should add new clients to reconnectmanager state", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", streams: [] };
                getUpdatedStats.mockResolvedValue({});
                expect(Object.keys(sut._clients).length).toBe(0);
                expect(sut._clients[client1.id]).toBeFalsy();

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client1],
                    },
                });

                expect(Object.keys(sut._clients).length).toBe(1);
                expect(sut._clients[client1.id]).toBeTruthy();
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client1]);
            });

            it("should not add existing clients to reconnectmanager state", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", streams: ["0"] };
                getUpdatedStats.mockResolvedValue({});
                sut._clients[client1.id] = client1;
                const mockRtcManager = {
                    hasClient: () => true,
                };
                sut.rtcManager = mockRtcManager;

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client1],
                    },
                });

                expect(Object.keys(sut._clients).length).toBe(1);
                expect(sut._clients[client1.id]).toBeTruthy();
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client1]);
            });

            it("should not try glitchfree if rtcmanager is unaware of client", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", streams: ["0"] };
                getUpdatedStats.mockResolvedValue({});
                sut._clients[client1.id] = client1;
                const mockRtcManager = {
                    hasClient: () => false,
                };
                sut.rtcManager = mockRtcManager;

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client1],
                    },
                });

                expect(Object.keys(sut._clients).length).toBe(1);
                expect(sut._clients[client1.id]).toBeTruthy();
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client1]);
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
                    const forwardEvent = jest.spyOn(sut, "emit");
                    const client1 = {
                        id: "id",
                        streams: isScreenshareEnabled ? ["0", "screenshareStreamid"] : ["0"],
                        isAudioEnabled,
                        isVideoEnabled,
                        isScreenshareEnabled,
                    };
                    getUpdatedStats.mockResolvedValue({ id: mockStatsMediaActive });
                    sut._clients[client1.id] = client1;
                    const mockRtcManager = {
                        hasClient: () => true,
                    };
                    sut.rtcManager = mockRtcManager;
                    const client2 = {
                        ...client1,
                        isAudioEnabled: audioChange,
                        isVideoEnabled: videoChange,
                        isScreenshareEnabled: screenshareChange,
                        streams: screenshareChange ? ["0", "screenshareStreamid"] : ["0"],
                    };

                    socket.emit("disconnect");
                    await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                        room: {
                            clients: [client2],
                        },
                    });

                    expect(client2.mergeWithOldClientState).toBe(shouldMerge);
                    expect(forwardEvent).toHaveBeenCalledTimes(1);
                    expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                    expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client2]);
                }
            );

            it.each([
                ["try glitchfree on active media", { id: mockStatsMediaActive }, true],
                ["not try glitchfree on inactive media", { id: mockStatsMediaNotActive }, undefined],
                ["not try glitchfree on missing stats", { bogus: {} }, undefined],
            ])("should %s", async (testCase, mockStats, shouldMerge) => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = {
                    id: "id",
                    streams: ["0", "screenshareStreamid"],
                    isAudioEnabled: true,
                    isVideoEnabled: true,
                    isScreenshareEnabled: true,
                };
                getUpdatedStats.mockResolvedValue(mockStats);
                sut._clients[client1.id] = client1;
                const mockRtcManager = {
                    hasClient: () => true,
                };
                sut.rtcManager = mockRtcManager;
                const client2 = { ...client1 };

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client2],
                    },
                });

                expect(client2.mergeWithOldClientState).toBe(shouldMerge);
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client2]);
            });

            it("should abort glitchfree on errors", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = {
                    id: "id",
                    streams: ["0"],
                    isAudioEnabled: false,
                    isVideoEnabled: false,
                    isScreenshareEnabled: false,
                };
                sut._clients[client1.id] = client1;
                const mockRtcManager = {
                    hasClient: () => {
                        throw new Error();
                    },
                };
                sut.rtcManager = mockRtcManager;

                socket.emit("disconnect");
                await socket.emit(PROTOCOL_RESPONSES.ROOM_JOINED, {
                    room: {
                        clients: [client1],
                    },
                });

                expect(client1.mergeWithOldClientState).toBeUndefined();
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.ROOM_JOINED);
                expect(forwardEvent.mock.calls[0][1].room.clients).toEqual([client1]);
            });
        });

        describe(PROTOCOL_RESPONSES.NEW_CLIENT, () => {
            it("should forward client reconnectmanager doesn't know about", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"] };

                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: client1 });

                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.NEW_CLIENT);
                expect(forwardEvent.mock.calls[0][1]).toEqual({ client: client1 });
            });

            it("should remove pending flag for returning client", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"] };
                sut._clients[client1.id] = {
                    ...client1,
                    isPendingToLeave: true,
                    timeoutHandler: setTimeout(() => {}, 3000),
                };

                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: client1 });

                expect(forwardEvent).toHaveBeenCalledTimes(0);
            });

            it("should remove pending flag for returning client", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"] };
                sut._clients[client1.id] = {
                    ...client1,
                    isPendingToLeave: true,
                    timeoutHandler: setTimeout(() => {}, 3000),
                };

                await socket.emit(PROTOCOL_RESPONSES.NEW_CLIENT, { client: { ...client1, id: "different" } });

                expect(sut._clients[client1.id].isPendingToLeave).toBeUndefined();
                expect(forwardEvent).toHaveBeenCalledTimes(2);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.CLIENT_LEFT);
                expect(forwardEvent.mock.calls[1][0]).toBe(PROTOCOL_RESPONSES.NEW_CLIENT);
            });
        });

        describe(PROTOCOL_RESPONSES.CLIENT_LEFT, () => {
            it("should forward event", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"] };
                const mockRtcManager = { disconnect: jest.fn() };
                sut.rtcManager = mockRtcManager;

                await socket.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, { clientId: client1.id, eventClaim: "claim" });

                expect(mockRtcManager.disconnect).toHaveBeenCalledWith(client1.id, null, "claim");
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.CLIENT_LEFT);
            });

            it("should remove client that was pending to leave from state", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"] };
                sut._clients[client1.id] = {
                    ...client1,
                    timeout: setTimeout(() => {}, 3000),
                    isPendingToLeave: true,
                };
                const mockRtcManager = {
                    disconnect: jest.fn(),
                };
                sut.rtcManager = mockRtcManager;

                await socket.emit(PROTOCOL_RESPONSES.CLIENT_LEFT, { clientId: client1.id, eventClaim: "claim" });

                expect(mockRtcManager.disconnect).toHaveBeenCalledWith(client1.id, null, "claim");
                expect(forwardEvent).toHaveBeenCalledTimes(1);
                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.CLIENT_LEFT);
                expect(Object.keys(sut._clients).length).toBe(0);
            });
        });

        describe(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, () => {
            it("should not emit events on missing client", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");

                await socket.emit(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, { clientId: "id" });

                expect(forwardEvent).not.toHaveBeenCalled();
            });

            it("should send client_left if media has stopped", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"], isVideoEnabled: true };
                sut._clients[client1.id] = client1;
                const mockRtcManager = { disconnect: jest.fn() };
                sut.rtcManager = mockRtcManager;
                getUpdatedStats.mockResolvedValue({ id: mockStatsMediaNotActive });

                await socket.emit(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, { clientId: client1.id });
                await sleep(501);

                expect(forwardEvent.mock.calls[0][0]).toBe(PROTOCOL_RESPONSES.CLIENT_LEFT);
            });

            it("should send not send client_left if client wasn't sending media", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"] };
                sut._clients[client1.id] = client1;
                const mockRtcManager = { disconnect: jest.fn() };
                sut.rtcManager = mockRtcManager;
                getUpdatedStats.mockResolvedValue({ id: mockStatsMediaNotActive });

                await socket.emit(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, { clientId: client1.id });
                await sleep(501);

                expect(forwardEvent).not.toHaveBeenCalled();
            });

            it("should not send client_left if media has stopped", async () => {
                const socket = createMockSocket();
                const sut = new ReconnectManager(socket);
                const forwardEvent = jest.spyOn(sut, "emit");
                const client1 = { id: "id", deviceId: "id", streams: ["0"], isVideoEnabled: true };
                sut._clients[client1.id] = client1;
                const mockRtcManager = { disconnect: jest.fn() };
                sut.rtcManager = mockRtcManager;
                getUpdatedStats.mockResolvedValue({ id: mockStatsMediaActive });

                await socket.emit(PROTOCOL_EVENTS.PENDING_CLIENT_LEFT, { clientId: client1.id });
                await sleep(1501);

                expect(forwardEvent).not.toHaveBeenCalled();
                expect(sut._clients[client1.id]).toBeTruthy();
            });
        });
    });
});
