import { appSlice } from "../app";

describe("appSlice", () => {
    describe("reducers", () => {
        describe("doAppConfigure", () => {
            it("should change the state", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "userAgent",
                    externalId: "externalId",
                };

                const result = appSlice.reducer(undefined, appSlice.actions.doAppConfigure(initialConfig));

                expect(result).toEqual({
                    isLoaded: true,
                    isActive: false,
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

                const result = appSlice.reducer(undefined, appSlice.actions.doAppConfigure(initialConfig));

                expect(result).toEqual({
                    isLoaded: true,
                    isActive: false,
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
