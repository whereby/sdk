import {
    notificationsSlice,
    NotificationsState,
    doClearNotifications,
    initialNotificationsState,
    SignalStatusEvent,
} from "../notifications";

describe("notificationsSlice", () => {
    describe("reducers", () => {
        it("addNotification", () => {
            const testNotification: SignalStatusEvent = {
                type: "signalOk",
                message: "Problems with your microphone have been detected and it is not delivering input",
                props: {},
                timestamp: Date.now(),
            };

            const result: NotificationsState = notificationsSlice.reducer(
                initialNotificationsState,
                notificationsSlice.actions.addNotification({ ...testNotification }),
            );

            expect(result.events).toEqual([
                {
                    ...testNotification,
                },
            ]);
        });

        it("doClearNotifications", () => {
            const testNotification: SignalStatusEvent = {
                type: "signalOk",
                message: "Problems with your microphone have been detected and it is not delivering input",
                props: {},
                timestamp: Date.now(),
            };

            const result: NotificationsState = notificationsSlice.reducer(
                {
                    ...initialNotificationsState,
                    events: [testNotification, testNotification],
                },
                doClearNotifications(),
            );

            expect(result.events).toEqual(initialNotificationsState.events);
        });
    });
});
