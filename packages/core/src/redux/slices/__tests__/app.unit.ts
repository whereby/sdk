import { appSlice } from "../app";

describe("appSlice", () => {
    describe("reducers", () => {
        describe("doAppStart", () => {
            it("should change the state", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    isDialIn: true,
                    isAssistant: false,
                    ignoreBreakoutGroups: true,
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "userAgent",
                    externalId: "externalId",
                };

                const result = appSlice.reducer(undefined, appSlice.actions.doAppStart(initialConfig));

                expect(result).toEqual({
                    isActive: true,
                    isDialIn: true,
                    isAssistant: false,
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

                const result = appSlice.reducer(undefined, appSlice.actions.doAppStart(initialConfig));

                expect(result).toEqual({
                    isActive: true,
                    isDialIn: false,
                    isAssistant: false,
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
    });
});
