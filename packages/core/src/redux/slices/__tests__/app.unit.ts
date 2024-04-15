import { appSlice } from "../app";

describe("appSlice", () => {
    describe("reducers", () => {
        describe("doAppJoin", () => {
            it("should change the state", () => {
                const result = appSlice.reducer(
                    undefined,
                    appSlice.actions.doAppJoin({
                        isNodeSdk: true,
                        roomUrl: "https://some.url/roomName",
                        roomKey: "roomKey",
                        displayName: "displayName",
                        userAgent: "userAgent",
                        externalId: "externalId",
                    }),
                );
    
                expect(result).toEqual({
                    wantsToJoin: true,
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "userAgent",
                    externalId: "externalId",
                    isNodeSdk: true,
                });
            });

            it("should change the state with default userAgent", () => {
                const result = appSlice.reducer(
                    undefined,
                    appSlice.actions.doAppJoin({
                        isNodeSdk: true,
                        roomUrl: "https://some.url/roomName",
                        roomKey: "roomKey",
                        displayName: "displayName",
                        externalId: "externalId",
                    }),
                );
    
                expect(result).toEqual({
                    wantsToJoin: true,
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    roomKey: "roomKey",
                    displayName: "displayName",
                    userAgent: "core:__PKG_VERSION__",
                    externalId: "externalId",
                    isNodeSdk: true,
                });
            });
        });
    });
});
