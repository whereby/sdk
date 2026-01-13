import { createStore, mockSignalEmit, mockServerSocket } from "../store.setup";
import { doSignalConnect, doSignalIdentifyDevice, doSignalDisconnect } from "../../slices/signalConnection";
import { randomDeviceCredentials } from "../../../__mocks__/appMocks";
import { diff } from "deep-object-diff";
import { ServerSocket } from "@whereby.com/media";

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
});
