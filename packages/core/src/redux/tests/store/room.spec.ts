import { createStore, mockServices, mockSignalEmit } from "../store.setup";
import { randomRemoteParticipant } from "../../../__mocks__/appMocks";

jest.mock("../../slices/app", () => ({
    ...jest.requireActual("../../slices/app"),
    doAppStop: jest.fn().mockReturnValue({ type: "TEST_ACTION" }),
}));

import { appSlice, doAppStart, doAppStop } from "../../slices/app";
import { rootReducer } from "../../store";
import { doLockRoom, doKickParticipant, doEndMeeting, doFetchRoom, setRequestedRoomUrl } from "../../slices/room";
import { signalEvents } from "../../slices/signalConnection/actions";

describe("reactors", () => {
    describe("fetching the requested room", () => {
        const roomUrl = "https://example.whereby.com/test";

        beforeEach(() => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValue({ isLocked: false });
        });

        it("fetches the room when a room url is requested", () => {
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(roomUrl));

            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(roomUrl);
            expect(store.getState().room.fetchedRoomUrl).toEqual(roomUrl);
        });

        it("fetches each room url once", () => {
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(roomUrl));
            store.dispatch(setRequestedRoomUrl(roomUrl));
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledTimes(1);

            store.dispatch(setRequestedRoomUrl("https://example.whereby.com/other"));
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledTimes(2);
        });

        it("doesn't fetch without a room url", () => {
            const store = createStore();

            store.dispatch(setRequestedRoomUrl(null));

            expect(mockServices.fetchRoomFromRoomUrl).not.toHaveBeenCalled();
        });

        it("waits until the room is left to fetch a room url requested during a call", () => {
            const store = createStore({ initialState: { app: { ...appSlice.getInitialState(), isActive: true } } });

            store.dispatch(setRequestedRoomUrl(roomUrl));
            expect(mockServices.fetchRoomFromRoomUrl).not.toHaveBeenCalled();

            // The real doAppStop: this file mocks the exported one.
            store.dispatch(appSlice.actions.doAppStop());
            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(roomUrl);
        });
    });
});

describe("actions", () => {
    describe("doFetchRoom", () => {
        const roomUrl = "https://example.whereby.com/test";

        it("stores whether the fetched room is locked", async () => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce({ isLocked: true });
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));

            expect(mockServices.fetchRoomFromRoomUrl).toHaveBeenCalledWith(roomUrl);
            expect(store.getState().room).toEqual(
                expect.objectContaining({ isLocked: true, lockStateSource: "fetch" }),
            );
        });

        it("leaves the lock state unknown when the fetch fails", async () => {
            mockServices.fetchRoomFromRoomUrl.mockRejectedValueOnce(new Error("Network error"));
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));

            expect(store.getState().room).toEqual(expect.objectContaining({ isLocked: false, lockStateSource: null }));
        });

        it("keeps the fetched lock state when the room is joined", async () => {
            mockServices.fetchRoomFromRoomUrl.mockResolvedValueOnce({ isLocked: true });
            const store = createStore();

            await store.dispatch(doFetchRoom(roomUrl));
            // Through the root reducer alone: dispatching doAppStart on the store would start the whole join.
            const state = rootReducer(
                store.getState(),
                doAppStart({ roomUrl, displayName: "Guest", roomKey: null, externalId: null }),
            );

            expect(state.room).toEqual(expect.objectContaining({ isLocked: true, lockStateSource: "fetch" }));
        });

        it("keeps the lock state from the signal server when the fetch finishes after it", async () => {
            let resolveFetch: (room: { isLocked: boolean }) => void = () => undefined;
            mockServices.fetchRoomFromRoomUrl.mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveFetch = resolve;
                }),
            );
            const store = createStore();

            const fetch = store.dispatch(doFetchRoom(roomUrl));
            store.dispatch(signalEvents.roomLocked({ isLocked: false }));
            resolveFetch({ isLocked: true });
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
