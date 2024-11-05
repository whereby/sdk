import { createStore, mockSignalEmit } from "../store.setup";
import { doKnockRoom, doConnectRoom } from "../../slices/roomConnection";
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
