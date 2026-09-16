/**
 * @jest-environment node
 */

import { browserDocument, browserWindow } from "../environment";

describe("environment in a non-browser (Node) environment", () => {
    it("has no window to begin with", () => {
        expect((globalThis as { window?: unknown }).window).toBeUndefined();
    });

    it("browserWindow returns undefined without throwing a ReferenceError", () => {
        expect(() => browserWindow()).not.toThrow();
        expect(browserWindow()).toBeUndefined();
    });

    it("browserDocument returns undefined without throwing a ReferenceError", () => {
        expect(() => browserDocument()).not.toThrow();
        expect(browserDocument()).toBeUndefined();
    });
});
