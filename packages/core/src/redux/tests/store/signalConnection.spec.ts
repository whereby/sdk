import { createStore, mockServices, mockSignalEmit, mockServerSocket } from "../store.setup";
import { doSignalConnect, doSignalIdentifyDevice, doSignalDisconnect } from "../../slices/signalConnection";
import { AppConfig, doAppStart, doAppStop } from "../../slices/app";
import { doGetDeviceCredentials } from "../../slices/deviceCredentials";
import { randomDeviceCredentials } from "../../../__mocks__/appMocks";
import { diff } from "deep-object-diff";
import { ServerSocket } from "@whereby.com/media";

jest.mock("@whereby.com/media", () => {
    return {
        __esModule: true,
        ServerSocket: jest.fn().mockImplementation(() => {
            return mockServerSocket;
        }),
    };
});

describe("signalConnectionSlice", () => {
    describe("actions", () => {
        it("doSignalConnect", () => {
            const store = createStore();

            store.dispatch(doSignalConnect());

            expect(ServerSocket).toHaveBeenCalledTimes(1);
            expect(mockServerSocket.connect).toHaveBeenCalledTimes(1);
        });

        it("doSignalIdentifyDevice", () => {
            const deviceCredentials = randomDeviceCredentials();
            const store = createStore({
                initialState: {
                    signalConnection: {
                        isIdentifyingDevice: false,
                        deviceIdentified: false,
                        status: "connected",
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        socket: mockServerSocket as any,
                    },
                },
            });

            const before = store.getState().signalConnection;

            store.dispatch(doSignalIdentifyDevice({ deviceCredentials }));

            const after = store.getState().signalConnection;

            expect(mockSignalEmit).toHaveBeenCalledWith("identify_device", { deviceCredentials });
            expect(diff(before, after)).toEqual({
                isIdentifyingDevice: true,
            });
        });

        it("doSignalDisconnect", () => {
            const store = createStore({
                withSignalConnection: true,
            });

            const before = store.getState().signalConnection;

            store.dispatch(doSignalDisconnect());

            const after = store.getState().signalConnection;

            expect(mockServerSocket.disconnect).toHaveBeenCalled();
            expect(diff(before, after)).toEqual({
                deviceIdentified: false,
                socket: null,
                status: "disconnected",
            });
        });
    });

    describe("when the join ends before it's done", () => {
        const appConfig: AppConfig = {
            displayName: "Test",
            externalId: null,
            roomKey: null,
            roomUrl: "https://example.whereby.com/test",
        };

        function mockSocket({ isConnected = false } = {}) {
            const socket = { ...mockServerSocket, disconnect: jest.fn(), isConnected: () => isConnected };
            (ServerSocket as unknown as jest.Mock).mockImplementationOnce(() => socket);
            return socket;
        }

        beforeEach(() => {
            mockServices.credentialsService.getCredentials.mockReturnValue(new Promise(() => {}));
            mockServices.fetchOrganizationFromRoomUrl.mockReturnValue(new Promise(() => {}));
        });

        it("closes the socket when the join fails, so it can't reconnect", async () => {
            const socket = mockSocket();
            const store = createStore();
            store.dispatch(doAppStart(appConfig));

            mockServices.credentialsService.getCredentials.mockRejectedValueOnce(new Error("Network error"));
            await store.dispatch(doGetDeviceCredentials());

            expect(socket.disconnect).toHaveBeenCalledTimes(1);
            expect(store.getState().signalConnection.status).toEqual("disconnected");
        });

        it("closes a socket that hasn't connected when the app stops", () => {
            const socket = mockSocket();
            const store = createStore();
            store.dispatch(doAppStart(appConfig));

            store.dispatch(doAppStop());

            expect(socket.disconnect).toHaveBeenCalledTimes(1);
        });

        it("keeps a connected socket open when the app stops, so leaving the room still reaches the server", () => {
            const socket = mockSocket({ isConnected: true });
            const store = createStore();
            store.dispatch(doAppStart(appConfig));

            store.dispatch(doAppStop());

            expect(socket.disconnect).not.toHaveBeenCalled();
        });

        it("leaves an earlier join's socket to the new join", async () => {
            const firstSocket = mockSocket();
            const secondSocket = mockSocket();
            const store = createStore();
            store.dispatch(doAppStart(appConfig));
            store.dispatch(doAppStart(appConfig));

            mockServices.credentialsService.getCredentials.mockRejectedValueOnce(new Error("Network error"));
            await store.dispatch(doGetDeviceCredentials());

            expect(firstSocket.disconnect).not.toHaveBeenCalled();
            expect(secondSocket.disconnect).toHaveBeenCalledTimes(1);
        });
    });
});
