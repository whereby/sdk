import { diff } from "deep-object-diff";
import { EventEmitter } from "events";

import { createStore } from "../store.setup";
import { signalEvents } from "../../slices/signalConnection";
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
});
