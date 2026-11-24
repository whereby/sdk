import { createStore } from "../store.setup";
import {
    doReorderClientViews,
    doSetClientViewOrder,
    selectSortedClientViews,
    setSortedClientIds,
} from "../../slices/roomLayout";
import { selectAllClientViews } from "../../slices/room";
import { randomLocalParticipant, randomRemoteParticipant, randomSignalClient } from "../../../__mocks__/appMocks";
import { signalEvents } from "../../slices/signalConnection/actions";

function setup(sortedClientIds: string[] = []) {
    const local = randomLocalParticipant({ id: "local" });
    const remotes = ["r1", "r2", "r3"].map((id) => randomRemoteParticipant({ id }));
    const store = createStore({
        initialState: {
            localParticipant: local,
            remoteParticipants: { remoteParticipants: remotes },
            roomLayout: { sortedClientIds },
        },
    });
    const order = () => selectSortedClientViews(store.getState()).map((c) => c.id);

    return { store, order };
}

describe("roomLayout", () => {
    describe("selectSortedClientViews", () => {
        it("should list local first, then remotes in join order, with no order set", () => {
            const { order } = setup();

            expect(order()).toEqual(["local", "r1", "r2", "r3"]);
        });

        it("should apply the order, appending unknown ids and ignoring departed ones", () => {
            const { order } = setup(["r3", "gone", "local"]);

            expect(order()).toEqual(["r3", "local", "r1", "r2"]);
        });

        it("should add a participant who joins later at the end", () => {
            const { store, order } = setup(["r3", "r2", "r1", "local"]);

            store.dispatch(signalEvents.newClient({ client: randomSignalClient({ id: "r4" }) }));

            expect(order()).toEqual(["r3", "r2", "r1", "local", "r4"]);
        });

        it("should leave selectAllClientViews in join order", () => {
            const { store } = setup(["r3", "local"]);

            expect(selectAllClientViews(store.getState()).map((c) => c.id)).toEqual(["local", "r1", "r2", "r3"]);
        });
    });

    describe("doReorderClientViews", () => {
        it("should swap two client views", () => {
            const { store, order } = setup();

            store.dispatch(doReorderClientViews({ id: "local", targetId: "r2" }));

            expect(order()).toEqual(["r2", "r1", "local", "r3"]);
        });

        it("should swap from the current order", () => {
            const { store, order } = setup(["r3", "r2", "r1", "local"]);

            store.dispatch(doReorderClientViews({ id: "r3", targetId: "local" }));

            expect(order()).toEqual(["local", "r2", "r1", "r3"]);
        });

        it("should keep the client view objects, so video elements don't remount", () => {
            const { store } = setup();
            const before = selectSortedClientViews(store.getState());

            store.dispatch(doReorderClientViews({ id: "r1", targetId: "r3" }));

            const after = selectSortedClientViews(store.getState());
            expect(after).not.toBe(before);
            expect(new Set(after)).toEqual(new Set(before));
            expect(after.find((c) => c.id === "r1")).toBe(before.find((c) => c.id === "r1"));
        });

        it("should do nothing when an id isn't a client view", () => {
            const { store, order } = setup();
            const before = store.getState().roomLayout;

            store.dispatch(doReorderClientViews({ id: "r1", targetId: "gone" }));

            expect(store.getState().roomLayout).toBe(before);
            expect(order()).toEqual(["local", "r1", "r2", "r3"]);
        });
    });

    describe("doSetClientViewOrder", () => {
        it("should move the listed client views to the front and keep the rest in their current order", () => {
            const { store, order } = setup(["r2", "r1", "local", "r3"]);

            store.dispatch(doSetClientViewOrder(["r3"]));

            expect(order()).toEqual(["r3", "r2", "r1", "local"]);
        });

        it("should keep the current order with an empty list", () => {
            const { store, order } = setup(["r2", "r1", "local", "r3"]);

            store.dispatch(doSetClientViewOrder([]));

            expect(order()).toEqual(["r2", "r1", "local", "r3"]);
        });
    });

    describe("setSortedClientIds", () => {
        it("should move the listed client views to the front", () => {
            const { store, order } = setup();

            store.dispatch(setSortedClientIds(["r3"]));

            expect(order()).toEqual(["r3", "local", "r1", "r2"]);
        });

        it("should go back to join order with an empty list", () => {
            const { store, order } = setup(["r3", "r2"]);

            store.dispatch(setSortedClientIds([]));

            expect(order()).toEqual(["local", "r1", "r2", "r3"]);
        });
    });
});
