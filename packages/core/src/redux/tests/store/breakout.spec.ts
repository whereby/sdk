import { createStore, mockSignalEmit } from "../store.setup";
import { doBreakoutJoin } from "../../slices/breakout";

describe("actions", () => {
    it("doBreakoutJoin", () => {
        const store = createStore({ withSignalConnection: true, connectToRoom: true });

        store.dispatch(doBreakoutJoin({ group: "a" }));

        expect(mockSignalEmit).toHaveBeenCalledWith("join_breakout_group", { group: "a" });
    });
});
