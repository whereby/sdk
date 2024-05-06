import { createStore } from "../store.setup";
import { Notification, NotificationsEventEmitter, doSetNotification } from "../../slices/notifications";
import { diff } from "deep-object-diff";
import { EventEmitter } from "events";

describe("actions", () => {
    it("doSetNotification", async () => {
        const now = Date.now();
        jest.spyOn(global.Date, "now").mockImplementationOnce(() => now);

        const testNotification: Notification = {
            type: "micNotWorking",
            message: "Problems with your microphone have been detected and it is not delivering input",
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

        const expectedTestNotificationEvent = {
            ...testNotification,
            level: "log",
            timestamp: now,
        };

        expect(notificationsEmitter.emit).toHaveBeenCalledWith(
            expectedTestNotificationEvent.level,
            expectedTestNotificationEvent,
        );

        expect(diff(before, after)).toEqual({
            events: { 0: expectedTestNotificationEvent },
        });
    });
});
