/**
 * @jest-environment node
 */

describe("@whereby.com/core in a non-browser (Node) environment", () => {
    it("does not throw when the redux slice (and its media dependency) is imported", () => {
        expect(() => {
            // eslint-disable-next-line
            require("../../index");
        }).not.toThrow();
    });
});
