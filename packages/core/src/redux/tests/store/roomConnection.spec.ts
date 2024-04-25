import { createStore, mockSignalEmit } from "../store.setup";
import { doKnockRoom, doConnectRoom, doJoinRoom, doLeaveRoom } from "../../slices/roomConnection";
import { diff } from "deep-object-diff";

describe("actions", () => {
    it("doKnockRoom", async () => {
        const store = createStore({ withSignalConnection: true });

        const before = store.getState().roomConnection;

        store.dispatch(doKnockRoom());

        const after = store.getState().roomConnection;

        expect(mockSignalEmit).toHaveBeenCalledWith("knock_room", expect.any(Object));
        expect(diff(before, after)).toEqual({
            status: "knocking",
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

    it("doJoinRoom", async () => {
        const store = createStore();

        const before = store.getState().app;

        store.dispatch(doJoinRoom());

        const after = store.getState().app;

        expect(diff(before, after)).toEqual({
            wantsToJoin: true,
        });
    });

    it("doLeaveRoom", async () => {
        const store = createStore({ withSignalConnection: true });

        const before = store.getState().roomConnection;

        store.dispatch(doLeaveRoom());

        const after = store.getState().roomConnection;

        expect(mockSignalEmit).toHaveBeenCalledWith("leave_room");
        expect(diff(before, after)).toEqual({
            status: "leaving",
        });
    });
});
