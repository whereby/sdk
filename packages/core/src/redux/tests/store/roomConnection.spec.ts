import { createStore, mockSignalEmit } from "../store.setup";
import { doKnockRoom, doConnectRoom } from "../../slices/roomConnection";
import { initialState as appInitialState } from "../../slices/app";
import { signalEvents } from "../../slices/signalConnection/actions";
import { diff } from "deep-object-diff";

describe("actions", () => {
    describe("doKnockRoom", () => {
        it("should knock if room is locked", async () => {
            const store = createStore({
                withSignalConnection: true,
                initialState: { roomConnection: { status: "room_locked", session: null, error: null } },
            });

            const before = store.getState().roomConnection;

            store.dispatch(doKnockRoom());

            const after = store.getState().roomConnection;

            expect(mockSignalEmit).toHaveBeenCalledWith("knock_room", expect.any(Object));
            expect(diff(before, after)).toEqual({
                status: "knocking",
            });
        });

        it("should abort knocking if room is not locked", async () => {
            const store = createStore({ withSignalConnection: true });

            expect(() => store.dispatch(doKnockRoom())).toThrow("Room is not locked, knock aborted");
            expect(mockSignalEmit).not.toHaveBeenCalled();
        });
    });

    describe("signalEvents.clientKicked", () => {
        it("should stop the app so local media and connections are cleaned up", () => {
            const store = createStore({
                withSignalConnection: true,
                connectToRoom: true,
                initialState: {
                    app: { ...appInitialState, isActive: true },
                },
            });

            store.dispatch(signalEvents.clientKicked({ clientId: "self-client-id" }));

            expect(store.getState().roomConnection.status).toEqual("kicked");
            expect(store.getState().app.isActive).toEqual(false);
        });
    });

    it("doConnectRoom", async () => {
        const store = createStore({ withSignalConnection: true });

        const before = store.getState().roomConnection;

        store.dispatch(doConnectRoom());

        const after = store.getState().roomConnection;

        expect(mockSignalEmit).toHaveBeenCalledWith("join_room", expect.any(Object));
        expect(diff(before, after)).toEqual({
            status: "connecting",
        });
    });
});
