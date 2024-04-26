import { appSlice } from "../app";

describe("appSlice", () => {
    describe("reducers", () => {
        describe("doAppJoin", () => {
            it("should change the state", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "userAgent",
                    externalId: "externalId",
                };

                const result = appSlice.reducer(undefined, appSlice.actions.doAppJoin(initialConfig));

                expect(result).toEqual({
                    wantsToJoin: false,
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "userAgent",
                    externalId: "externalId",
                    isNodeSdk: true,
                    initialConfig,
                    isLoaded: true,
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

                const result = appSlice.reducer(undefined, appSlice.actions.doAppJoin(initialConfig));

                expect(result).toEqual({
                    wantsToJoin: false,
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "core:__PKG_VERSION__",
                    externalId: "externalId",
                    isNodeSdk: true,
                    initialConfig,
                    isLoaded: true,
                });
            });
        });
    });
});
