import { createStore } from "../store.setup";
import { NotificationsEventEmitter, SignalStatusEvent, doSetNotification } from "../../slices/notifications";
import { diff } from "deep-object-diff";
import { EventEmitter } from "events";

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
