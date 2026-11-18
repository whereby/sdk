import { roomLayoutSlice, setSortedClientIds, sortClientViews } from "../roomLayout";

const views = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("roomLayoutSlice", () => {
    describe("reducers", () => {
        describe("setSortedClientIds", () => {
            it("should set the order", () => {
                const result = roomLayoutSlice.reducer(undefined, setSortedClientIds(["b", "a"]));

                expect(result.sortedClientIds).toEqual(["b", "a"]);
            });

            it("should drop repeated ids, keeping the first", () => {
                const result = roomLayoutSlice.reducer(undefined, setSortedClientIds(["b", "a", "b"]));

                expect(result.sortedClientIds).toEqual(["b", "a"]);
            });
        });
    });

    describe("sortClientViews", () => {
        it("should return the same array when there is no order", () => {
            const clientViews = views("a", "b");

            expect(sortClientViews({ sortedClientIds: [], clientViews })).toBe(clientViews);
        });

        it("should order client views by the sorted ids", () => {
            const result = sortClientViews({ sortedClientIds: ["c", "a", "b"], clientViews: views("a", "b", "c") });

            expect(ids(result)).toEqual(["c", "a", "b"]);
        });

        it("should append client views missing from the order, keeping their order", () => {
            const result = sortClientViews({ sortedClientIds: ["b", "a"], clientViews: views("d", "a", "b", "c") });

            expect(ids(result)).toEqual(["b", "a", "d", "c"]);
        });

        it("should ignore ids with no client view", () => {
            const result = sortClientViews({ sortedClientIds: ["gone", "b", "a"], clientViews: views("a", "b") });

            expect(ids(result)).toEqual(["b", "a"]);
        });

        it("should keep the same client view objects", () => {
            const clientViews = views("a", "b");
            const result = sortClientViews({ sortedClientIds: ["b", "a"], clientViews });

            expect(result[0]).toBe(clientViews[1]);
            expect(result[1]).toBe(clientViews[0]);
        });
    });
});
