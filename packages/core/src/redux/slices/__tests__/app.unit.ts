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

            it("should decode an encoded roomName", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    roomUrl: "https://some.url/r%C3%B6omname",
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
                    roomName: "/röomname",
                    roomUrl: "https://some.url/r%C3%B6omname",
                    userAgent: "core:__PKG_VERSION__",
                });
            });

            it("should leave an unencoded roomUrl unchanged", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    roomUrl: "https://some.url/roomname",
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
                    roomName: "/roomname",
                    roomUrl: "https://some.url/roomname",
                    userAgent: "core:__PKG_VERSION__",
                });
            });

            it("should return the original url if roomUrl contains a malformed URI", () => {
                const initialConfig = {
                    isNodeSdk: true,
                    roomUrl: "https://some.url/%E0%A4%A",
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
                    roomName: "/%E0%A4%A",
                    roomUrl: "https://some.url/%E0%A4%A",
                    userAgent: "core:__PKG_VERSION__",
                });
            });
        });
    });
});
