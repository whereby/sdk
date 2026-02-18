import { appSlice } from "../app";

describe("appSlice", () => {
    describe("reducers", () => {
        describe("doAppStart", () => {
            it("should change the state", () => {
                const initialConfig = {
                    displayName: "displayName",
                    externalId: "externalId",
                    ignoreBreakoutGroups: true,
                    isAssistant: false,
                    isAudioRecorder: false,
                    isDialIn: true,
                    isNodeSdk: true,
                    roomKey: "roomKey",
                    roomUrl: "https://some.url/roomName",
                    userAgent: "userAgent",
                };

                const result = appSlice.reducer(undefined, appSlice.actions.doAppStart(initialConfig));

                expect(result).toEqual({
                    displayName: "displayName",
                    externalId: "externalId",
                    ignoreBreakoutGroups: true,
                    initialConfig,
                    isActive: true,
                    isAssistant: false,
                    isAudioRecorder: false,
                    isDialIn: true,
                    isNodeSdk: true,
                    roomKey: "roomKey",
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    userAgent: "userAgent",
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
                    displayName: "displayName",
                    externalId: "externalId",
                    ignoreBreakoutGroups: false,
                    initialConfig,
                    isActive: true,
                    isAssistant: false,
                    isAudioRecorder: false,
                    isDialIn: false,
                    isNodeSdk: true,
                    roomKey: "roomKey",
                    roomName: "/roomName",
                    roomUrl: "https://some.url/roomName",
                    userAgent: "core:__PKG_VERSION__",
                });
            });
        });
    });
});
