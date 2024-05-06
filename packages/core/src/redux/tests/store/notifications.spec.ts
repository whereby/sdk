import { createStore } from "../store.setup";
import { NotificationEvent, doSetNotification } from "../../slices/notifications";
import { diff } from "deep-object-diff";
import { EventEmitter } from "events";

describe("actions", () => {
    it("doSetNotification", async () => {
        const now = Date.now();
        jest.spyOn(global.Date, "now").mockImplementationOnce(() => now);

        const testNotification: NotificationEvent = {
            type: "micNotWorking",
            message: "Problems with your microphone have been detected and it is not delivering input",
        };

        const notificationsEmitter = new EventEmitter();
        jest.spyOn(notificationsEmitter, "emit");

        const store = createStore({
            initialState: {
                notifications: {
                    messages: [],
                    emitter: notificationsEmitter,
                },
            },
        });

        const before = store.getState().notifications;

        store.dispatch(doSetNotification(testNotification));

        const after = store.getState().notifications;

        const expectedTestNotificationMessage = {
            ...testNotification,
            level: "log",
            timestamp: now,
        };

        expect(notificationsEmitter.emit).toHaveBeenCalledWith(
            expectedTestNotificationMessage.level,
            expectedTestNotificationMessage,
        );

        expect(diff(before, after)).toEqual({
            messages: { 0: expectedTestNotificationMessage },
        });
    });
});
