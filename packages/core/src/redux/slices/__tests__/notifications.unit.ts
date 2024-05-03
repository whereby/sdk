import {
    notificationsSlice,
    NotificationMessage,
    NotificationsState,
    doClearNotifications,
    initialNotificationsState,
} from "../notifications";

describe("notificationsSlice", () => {
    describe("reducers", () => {
        it("addNotification", () => {
            const testNotification: NotificationMessage = {
                type: "micNotWorking",
                message: "Problems with your microphone have been detected and it is not delivering input",
                level: "error",
                timestamp: Date.now(),
            };

            const result: NotificationsState = notificationsSlice.reducer(
                initialNotificationsState,
                notificationsSlice.actions.addNotification({ ...testNotification }),
            );

            expect(result.messages).toEqual([
                {
                    ...testNotification,
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
                    ...initialNotificationsState,
                    messages: [testNotification, testNotification],
                },
                doClearNotifications(),
            );

            expect(result.messages).toEqual(initialNotificationsState.messages);
        });
    });
});
