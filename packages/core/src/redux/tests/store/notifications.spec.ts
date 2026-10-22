import { diff } from "deep-object-diff";
import { EventEmitter } from "events";

import { createStore } from "../store.setup";
import { signalEvents, socketConnected } from "../../slices/signalConnection";
import { ConnectionStatus, roomRejoined } from "../../slices/roomConnection";
import { mockServerSocket } from "../store.setup";
import { NotificationsEventEmitter, SignalStatusEvent, doSetNotification } from "../../slices/notifications";

describe("actions", () => {
    it("doSetNotification", async () => {
        const now = Date.now();
        jest.spyOn(global.Date, "now").mockImplementationOnce(() => now);

        const testNotification: SignalStatusEvent = {
            type: "signalOk",
            message: "Problems with your microphone have been detected and it is not delivering input",
            props: {},
            timestamp: now,
        };

        const notificationsEmitter: NotificationsEventEmitter = new EventEmitter();
        jest.spyOn(notificationsEmitter, "emit");

        const store = createStore({
            initialState: {
                notifications: {
                    events: [],
                    emitter: notificationsEmitter,
                },
            },
        });

        const before = store.getState().notifications;

        store.dispatch(doSetNotification(testNotification));

        const after = store.getState().notifications;

        expect(notificationsEmitter.emit).toHaveBeenCalledWith(testNotification.type, testNotification);

        expect(diff(before, after)).toEqual({
            events: { 0: testNotification },
        });
    });
});

describe("reactors", () => {
    describe("signalEvents.clientUnableToJoin", () => {
        it("notifies of a client unable to join a full room", () => {
            const notificationsEmitter: NotificationsEventEmitter = new EventEmitter();
            jest.spyOn(notificationsEmitter, "emit");
            const store = createStore({
                initialState: {
                    notifications: {
                        events: [],
                        emitter: notificationsEmitter,
                    },
                },
            });

            const before = store.getState().notifications;

            store.dispatch(
                signalEvents.clientUnableToJoin({
                    error: "room_full",
                    displayName: "locked out",
                }),
            );

            const after = store.getState().notifications;

            expect(notificationsEmitter.emit).toHaveBeenCalledWith(
                "clientUnableToJoinFullRoom",
                expect.objectContaining({ message: "Someone tried to join but the room is full and at capacity." }),
            );

            expect(diff(before, after)).toEqual({
                events: {
                    0: expect.objectContaining({
                        message: "Someone tried to join but the room is full and at capacity.",
                    }),
                },
            });
        });

        it("ignores other clientUnableToJoinErrors", () => {
            const notificationsEmitter: NotificationsEventEmitter = new EventEmitter();
            jest.spyOn(notificationsEmitter, "emit");
            const store = createStore({
                initialState: {
                    notifications: {
                        events: [],
                        emitter: notificationsEmitter,
                    },
                },
            });

            const before = store.getState().notifications;

            store.dispatch(
                signalEvents.clientUnableToJoin({
                    error: "Some other error",
                    displayName: "Uh oh",
                }),
            );

            const after = store.getState().notifications;

            expect(notificationsEmitter.emit).not.toHaveBeenCalledWith("clientUnableToJoinFullRoom", expect.anything);

            expect(diff(before, after)).toEqual({});
        });
    });

    describe("signal status", () => {
        const createSignalStore = ({
            status = "reconnecting",
            isRejoining,
        }: {
            status?: ConnectionStatus;
            isRejoining: boolean;
        }) => {
            const notificationsEmitter: NotificationsEventEmitter = new EventEmitter();
            jest.spyOn(notificationsEmitter, "emit");
            const store = createStore({
                connectToRoom: true,
                initialState: {
                    notifications: { events: [], emitter: notificationsEmitter },
                    roomConnection: {
                        status,
                        session: null,
                        error: null,
                        knockResponse: null,
                        isRejoining,
                    },
                },
            });
            return { store, notificationsEmitter };
        };

        it("sends signalOk when the socket reconnects", () => {
            const { store, notificationsEmitter } = createSignalStore({ isRejoining: true });

            store.dispatch(socketConnected(mockServerSocket as never));

            expect(notificationsEmitter.emit).toHaveBeenCalledWith("signalOk", expect.anything());
            expect(notificationsEmitter.emit).not.toHaveBeenCalledWith("reconnected", expect.anything());
        });

        it("sends reconnecting when the connection drops while in the room", () => {
            const { store, notificationsEmitter } = createSignalStore({ status: "connected", isRejoining: false });

            store.dispatch(signalEvents.disconnect({ willReconnect: true }));

            expect(notificationsEmitter.emit).toHaveBeenCalledWith(
                "reconnecting",
                expect.objectContaining({ type: "reconnecting" }),
            );
        });

        it("sends reconnecting only once if the connection drops again while rejoining", () => {
            const { store, notificationsEmitter } = createSignalStore({ status: "connected", isRejoining: false });

            store.dispatch(signalEvents.disconnect({ willReconnect: true }));
            store.dispatch(signalEvents.disconnect({ willReconnect: true }));

            expect(
                (notificationsEmitter.emit as jest.Mock).mock.calls.filter(([type]) => type === "reconnecting"),
            ).toHaveLength(1);
        });

        it("doesn't send reconnecting when the socket won't reconnect", () => {
            const { store, notificationsEmitter } = createSignalStore({ status: "connected", isRejoining: false });

            store.dispatch(signalEvents.disconnect({ willReconnect: false }));

            expect(notificationsEmitter.emit).not.toHaveBeenCalledWith("reconnecting", expect.anything());
        });

        it("doesn't send reconnecting when the connection drops outside the room", () => {
            const { store, notificationsEmitter } = createSignalStore({ status: "knocking", isRejoining: false });

            store.dispatch(signalEvents.disconnect({ willReconnect: true }));

            expect(notificationsEmitter.emit).not.toHaveBeenCalledWith("reconnecting", expect.anything());
        });

        it("sends reconnected when the room is rejoined", () => {
            const { store, notificationsEmitter } = createSignalStore({ isRejoining: true });

            store.dispatch(roomRejoined({ selfId: "second-id", previousSelfId: "first-id" }));

            expect(notificationsEmitter.emit).toHaveBeenCalledWith(
                "reconnected",
                expect.objectContaining({ type: "reconnected" }),
            );
        });
    });
});
