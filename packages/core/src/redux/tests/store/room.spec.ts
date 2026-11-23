import { createStore, mockServices, mockSignalEmit } from "../store.setup";
import { randomRemoteParticipant } from "../../../__mocks__/appMocks";

jest.mock("../../slices/app", () => ({
    ...jest.requireActual("../../slices/app"),
    doAppStop: jest.fn().mockReturnValue({ type: "TEST_ACTION" }),
}));

import { appSlice, doAppStart, doAppStop } from "../../slices/app";
import { rootReducer } from "../../store";
import {
    doLockRoom,
    doKickParticipant,
    doEndMeeting,
    doFetchRoom,
    roomSliceInitialState,
    selectRoomLockState,
    selectShouldFetchRoom,
    setRequestedRoomUrl,
} from "../../slices/room";
import { signalEvents } from "../../slices/signalConnection/actions";

const fetchedRoom = (isLocked: boolean) => ({ isClaimed: true, isBanned: false, isLocked });

async function flushPromises() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

describe("reactors", () => {
    describe("fetching the requested room", () => {
        const roomUrl = "https://example.whereby.com/test";
        const otherRoomUrl = "https://example.whereby.com/other";
        const inRoom = { app: { ...appSlice.getInitialState(), isActive: true } };

        beforeEach(() => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValue(fetchedRoom(false));
        });

        it("fetches the room when a room url is requested", () => {
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(roomUrl));

            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(roomUrl);
            expect(store.getState().room.lockStateRoomUrl).toEqual(roomUrl);
        });

        it("fetches each room url once, and another room url even while the first is still being fetched", () => {
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(roomUrl));
            store.dispatch(setRequestedRoomUrl(roomUrl));
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledTimes(1);

            store.dispatch(setRequestedRoomUrl(otherRoomUrl));
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledTimes(2);
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenLastCalledWith(otherRoomUrl);
        });

        it("doesn't fetch without a room url", () => {
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(null));

            expect(mockServices.fetchRoomFromRoomUrl).not.toHaveBeenCalled();
        });

        it("waits until the room is left to fetch a room url requested while in it", () => {
            const store = createStore({ initialState: inRoom });

            store.dispatch(setRequestedRoomUrl(roomUrl));
            expect(mockServices.fetchRoomFromRoomUrl).not.toHaveBeenCalled();

            // The real doAppStop: this file mocks the exported one.
            store.dispatch(appSlice.actions.doAppStop());
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(roomUrl);
        });

        it("doesn't fetch the room just left, keeping the lock state from the signal server", () => {
            const store = createStore({
                initialState: {
                    ...inRoom,
                    room: {
                        ...roomSliceInitialState,
                        lockStateRoomUrl: roomUrl,
                        requestedRoomUrl: roomUrl,
                        isInRoom: true,
                    },
                },
            });

            store.dispatch(signalEvents.roomLocked({ isLocked: true }));
            store.dispatch(appSlice.actions.doAppStop());

            expect(mockServices.fetchRoomFromRoomUrl).not.toHaveBeenCalled();
            expect(selectRoomLockState(store.getState())).toEqual(true);
        });

        it("uses the next room's fetch, not a lock event from the room just left that arrives after leaving", async () => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValue(fetchedRoom(false));
            const store = createStore({
                initialState: {
                    ...inRoom,
                    room: {
                        ...roomSliceInitialState,
                        lockStateRoomUrl: roomUrl,
                        requestedRoomUrl: roomUrl,
                        isInRoom: true,
                    },
                },
            });

            store.dispatch(signalEvents.roomLocked({ isLocked: true }));
            store.dispatch(appSlice.actions.doAppStop());
            store.dispatch(setRequestedRoomUrl(otherRoomUrl));
            store.dispatch(signalEvents.roomLocked({ isLocked: true }));
            await flushPromises();

            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(otherRoomUrl);
            expect(store.getState().room).toEqual(
                expect.objectContaining({ isLocked: false, lockStateSource: "fetch", lockStateRoomUrl: otherRoomUrl }),
            );
        });

        it("fetches the room just left when the signal server never sent its lock state", () => {
            const store = createStore({
                initialState: {
                    ...inRoom,
                    room: { ...roomSliceInitialState, lockStateRoomUrl: roomUrl, requestedRoomUrl: roomUrl },
                },
            });

            store.dispatch(appSlice.actions.doAppStop());

            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(roomUrl);
        });

        it("doesn't fetch again after leaving when the lock state came from a fetch", () => {
            const store = createStore({
                initialState: {
                    ...inRoom,
                    room: {
                        ...roomSliceInitialState,
                        lockStateSource: "fetch",
                        lockStateRoomUrl: roomUrl,
                        requestedRoomUrl: roomUrl,
                        roomFetchStatus: "fetched",
                    },
                },
            });

            store.dispatch(appSlice.actions.doAppStop());

            expect(mockServices.fetchRoomFromRoomUrl).not.toHaveBeenCalled();
        });

        it("fetches a room whose fetch failed again only when it's requested again", async () => {
            mockServices.fetchRoomFromRoomUrl.mockRejectedValueOnce(new Error("Network error"));
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(roomUrl));
            await flushPromises();
            expect(store.getState().room.roomFetchStatus).toEqual("failed");
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledTimes(1);

            store.dispatch(setRequestedRoomUrl(roomUrl));
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledTimes(2);
        });
    });
});

describe("actions", () => {
    describe("doFetchRoom", () => {
        const roomUrl = "https://example.whereby.com/test";
        const joinRoom = (url: string) =>
            doAppStart({ roomUrl: url, displayName: "Guest", roomKey: null, externalId: null });

        it("stores whether the fetched room is locked", async () => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce(fetchedRoom(true));
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));

            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(roomUrl);
            expect(selectRoomLockState(store.getState())).toEqual(true);
        });

        it.each`
            room                                                      | description
            ${{ isClaimed: false, isBanned: false, isLocked: false }} | ${"doesn't exist"}
            ${{ isClaimed: true, isBanned: true, isLocked: false }}   | ${"is banned"}
        `("leaves the lock state unknown when the room $description", async ({ room }) => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce(room);
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));

            expect(selectRoomLockState(store.getState())).toEqual(null);
        });

        it("leaves the lock state unknown when the fetch fails", async () => {
            mockServices.fetchRoomFromRoomUrl.mockRejectedValueOnce(new Error("Network error"));
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));

            expect(selectRoomLockState(store.getState())).toEqual(null);
        });

        // Through the root reducer alone: dispatching doAppStart on the store would start the whole join.
        it("keeps the fetched lock state when that room is joined", async () => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce(fetchedRoom(true));
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));
            const state = rootReducer(store.getState(), joinRoom(roomUrl));

            expect(selectRoomLockState(state)).toEqual(true);
        });

        it("forgets the fetched lock state when another room is joined", async () => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce(fetchedRoom(true));
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));
            const state = rootReducer(store.getState(), joinRoom("https://example.whereby.com/other"));

            expect(selectRoomLockState(state)).toEqual(null);
        });

        it("keeps the requested room when another room is joined, so it's fetched after leaving", async () => {
            const otherRoomUrl = "https://example.whereby.com/other";
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce(fetchedRoom(false));
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(otherRoomUrl));
            await flushPromises();
            const state = rootReducer(store.getState(), joinRoom(roomUrl));

            expect(state.room.requestedRoomUrl).toEqual(otherRoomUrl);
        });

        it("keeps the signal server's lock state after leaving another room joined, without fetching it", async () => {
            const otherRoomUrl = "https://example.whereby.com/other";
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce(fetchedRoom(false));
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));
            let state = rootReducer(store.getState(), setRequestedRoomUrl(otherRoomUrl));
            state = rootReducer(state, joinRoom(otherRoomUrl));
            state = rootReducer(state, signalEvents.roomLocked({ isLocked: true }));
            state = rootReducer(state, appSlice.actions.doAppStop());

            expect(selectRoomLockState(state)).toEqual(true);
            expect(selectShouldFetchRoom(state)).toEqual(false);
        });

        it("applies a fetch still in flight when its room is joined, if it answers before the signal server", () => {
            let state = rootReducer(undefined, setRequestedRoomUrl(roomUrl));
            state = rootReducer(state, doFetchRoom.pending("request-id", roomUrl));
            state = rootReducer(state, joinRoom(roomUrl));
            state = rootReducer(state, doFetchRoom.fulfilled({ isLocked: true }, "request-id", roomUrl));

            expect(selectRoomLockState(state)).toEqual(true);
        });

        it("keeps the lock state from the signal server when the fetch finishes after it", async () => {
            let resolveFetch: (room: ReturnType<typeof fetchedRoom>) => void = () => undefined;
            mockServices.fetchRoomFromRoomUrl.mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveFetch = resolve;
                }),
            );
            const store = createStore({ initialState: { room: { ...roomSliceInitialState, isInRoom: true } } });

            const fetch = store.dispatch(doFetchRoom(roomUrl));
            store.dispatch(signalEvents.roomLocked({ isLocked: false }));
            resolveFetch(fetchedRoom(true));
            await fetch;

            expect(store.getState().room).toEqual(
                expect.objectContaining({ isLocked: false, lockStateSource: "signal" }),
            );
        });
    });

    describe("doLockRoom", () => {
        describe("when authorized", () => {
            it("should lock room", () => {
                const store = createStore({
                    initialState: { authorization: { roomKey: null, roleName: "host" } },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doLockRoom({ locked: true }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("set_lock", { locked: true });
            });
        });

        describe("when not authorized", () => {
            it("should not lock room", () => {
                const store = createStore({
                    initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doLockRoom({ locked: true }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });

    describe("doKickParticipant", () => {
        describe("when authorized", () => {
            it("should kick client from room", () => {
                const remoteParticipant = randomRemoteParticipant();

                const store = createStore({
                    initialState: {
                        authorization: { roomKey: null, roleName: "host" },
                        remoteParticipants: { remoteParticipants: [remoteParticipant] },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doKickParticipant({ clientId: remoteParticipant.id }))).not.toThrow();

                expect(mockSignalEmit).toHaveBeenCalledWith("kick_client", {
                    clientId: remoteParticipant.id,
                    reasonId: "kick",
                });
            });
        });

        describe("when not authorized", () => {
            it("should not kick client from room", () => {
                const remoteParticipant = randomRemoteParticipant();

                const store = createStore({
                    initialState: {
                        authorization: { roomKey: null, roleName: "visitor" },
                        remoteParticipants: { remoteParticipants: [remoteParticipant] },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doKickParticipant({ clientId: remoteParticipant.id }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });

    describe("doEndMeeting", () => {
        const remoteParticipants = [randomRemoteParticipant(), randomRemoteParticipant(), randomRemoteParticipant()];

        describe("when authorized", () => {
            describe("with stayBehind: false", () => {
                it("should end the meeting for all remote participants and local participant should also leave room", () => {
                    const store = createStore({
                        initialState: {
                            authorization: { roomKey: null, roleName: "host" },
                            remoteParticipants: {
                                remoteParticipants,
                            },
                        },
                        withSignalConnection: true,
                    });

                    expect(() => store.dispatch(doEndMeeting({ stayBehind: false }))).not.toThrow();

                    expect(mockSignalEmit).toHaveBeenCalledTimes(1);
                    expect(mockSignalEmit).toHaveBeenCalledWith("kick_client", {
                        clientIds: remoteParticipants.map(({ id }) => id),
                        reasonId: "end-meeting",
                    });

                    expect(doAppStop).toHaveBeenCalled();
                });
            });

            describe("with stayBehind: true", () => {
                it("should end the meeting for all remote participants but the local participant should not leave the room", () => {
                    const store = createStore({
                        initialState: {
                            authorization: { roomKey: null, roleName: "host" },
                            remoteParticipants: {
                                remoteParticipants,
                            },
                        },
                        withSignalConnection: true,
                    });

                    expect(() => store.dispatch(doEndMeeting({ stayBehind: true }))).not.toThrow();

                    expect(mockSignalEmit).toHaveBeenCalledTimes(1);
                    expect(mockSignalEmit).toHaveBeenCalledWith("kick_client", {
                        clientIds: remoteParticipants.map(({ id }) => id),
                        reasonId: "end-meeting",
                    });

                    expect(doAppStop).not.toHaveBeenCalled();
                });
            });
        });

        describe("when not authorized", () => {
            it("should not end the meeting for any participants", () => {
                const store = createStore({
                    initialState: {
                        authorization: { roomKey: null, roleName: "visitor" },
                        remoteParticipants: { remoteParticipants },
                    },
                    withSignalConnection: true,
                });

                expect(() => store.dispatch(doEndMeeting({ stayBehind: false }))).toThrow(
                    `Not authorized to perform this action`,
                );

                expect(mockSignalEmit).not.toHaveBeenCalled();
            });
        });
    });
});
