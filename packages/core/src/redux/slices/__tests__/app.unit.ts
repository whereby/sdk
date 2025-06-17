import { appSlice } from "../app";

describe("appSlice", () => {
    describe("reducers", () => {
        describe("doAppSetup", () => {
            it("should change the state", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    isDialIn: true,
                    ignoreBreakoutGroups: true,
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "userAgent",
                    externalId: "externalId",
                };

                const result = appSlice.reducer(undefined, appSlice.actions.doAppSetup(initialConfig));

                expect(result).toEqual({
                    isActive: false,
                    isDialIn: true,
                    ignoreBreakoutGroups: true,
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "userAgent",
                    externalId: "externalId",
                    isNodeSdk: true,
                    initialConfig,
                });
            });

            it("should change the state with default userAgent", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    externalId: "externalId",
                };

                const result = appSlice.reducer(undefined, appSlice.actions.doAppSetup(initialConfig));

                expect(result).toEqual({
                    isActive: false,
                    isDialIn: false,
                    ignoreBreakoutGroups: false,
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "core:__PKG_VERSION__",
                    externalId: "externalId",
                    isNodeSdk: true,
                    initialConfig,
                });
            });
        });

        describe("doAppStart", () => {
            it("should set sdk app to an active state", () => {
                const result = appSlice.reducer(undefined, appSlice.actions.doAppStart());

                expect(result.isActive).toEqual(true);
            });
        });

        describe("doAppStop", () => {
            beforeEach(() => {
                appSlice.reducer(undefined, appSlice.actions.doAppStart());
            });

            it("should set sdk app to an inactive state", () => {
                const result = appSlice.reducer(undefined, appSlice.actions.doAppStop());

                expect(result.isActive).toEqual(false);
            });
        });
    });
});
