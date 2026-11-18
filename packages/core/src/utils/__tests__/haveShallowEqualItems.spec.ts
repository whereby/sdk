import haveShallowEqualItems from "../haveShallowEqualItems";

describe("haveShallowEqualItems", () => {
    const stream = {};

    it("is true for items with identical values", () => {
        expect(haveShallowEqualItems([{ id: "1", stream }], [{ id: "1", stream }])).toBe(true);
    });

    it("is false for a different number of items", () => {
        expect(haveShallowEqualItems([{ id: "1" }], [{ id: "1" }, { id: "2" }])).toBe(false);
    });

    it("is false when a value differs", () => {
        expect(haveShallowEqualItems([{ id: "1" }], [{ id: "2" }])).toBe(false);
    });

    it("is false when a nested value is equal but not identical", () => {
        expect(haveShallowEqualItems([{ id: "1", stream: {} }], [{ id: "1", stream: {} }])).toBe(false);
    });

    it("is false when an item has a different set of keys", () => {
        expect(
            haveShallowEqualItems<{ id: string; name?: string }>([{ id: "1" }], [{ id: "1", name: undefined }]),
        ).toBe(false);
    });
});
