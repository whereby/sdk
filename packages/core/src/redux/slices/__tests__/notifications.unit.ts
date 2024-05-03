import {
    notificationsSlice,
    doSetNotification,
    NotificationEvent,
    NotificationMessage,
    NotificationsState,
    doClearNotifications,
    initialNotificationsState,
} from "../notifications";

describe("notificationsSlice", () => {
    describe("reducers", () => {
        it("doSetNotification", () => {
            const now = Date.now();
            jest.spyOn(global.Date, "now").mockImplementationOnce(() => now);

            const testNotification: NotificationEvent = {
                type: "micNotWorking",
                message: "Problems with your microphone have been detected and it is not delivering input",
                level: "error",
            };

            const result: NotificationsState = notificationsSlice.reducer(
                initialNotificationsState,
                doSetNotification({ ...testNotification }),
            );

            expect(result.messages).toEqual([
                {
                    ...testNotification,
                    timestamp: now,
                },
            ]);
        });

        it("doClearNotifications", () => {
            const testNotification: NotificationMessage = {
                type: "micNotWorking",
                message: "Problems with your microphone have been detected and it is not delivering input",
                level: "error",
                timestamp: Date.now(),
            };

            const result: NotificationsState = notificationsSlice.reducer(
                {
                    messages: [testNotification, testNotification],
                },
                doClearNotifications(),
            );

            expect(result.messages).toEqual(initialNotificationsState.messages);
        });
    });
});
