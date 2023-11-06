import assert from "../../src/utils/assert";

describe("assert", () => {
    describe("ok", () => {
        it("should throw when value is not passed", () => {
            expect(() => {
                assert.ok();
            }).toThrow("No value argument passed to `assert.ok()`");
        });

        it.each`
            value        | message
            ${false}     | ${"false is passed"}
            ${0}         | ${"0 is passed"}
            ${""}        | ${"empty string is passed"}
            ${null}      | ${"null is passed"}
            ${undefined} | ${"undefined is passed"}
        `("should throw an error when $message", ({ value, message }) => {
            expect(() => {
                assert.ok(value, message);
            }).toThrow();
        });

        it.each`
            value       | message
            ${true}     | ${"true is passed"}
            ${1}        | ${"number is passed"}
            ${"test"}   | ${"string is passed"}
            ${[]}       | ${"array is passed"}
            ${{}}       | ${"object is passed"}
            ${() => {}} | ${"function is passed"}
        `("should not throw an error when $message", ({ value, message }) => {
            expect(() => {
                assert.ok(value, message);
            }).not.toThrow();
        });
    });

    describe("notEqual", () => {
        it("should throw when actual and expected are not passed", () => {
            expect(() => {
                assert.notEqual();
            }).toThrow("'actual' and 'expected' arguments are required");
        });

        it.each`
            actual       | expected     | message
            ${"test"}    | ${"test"}    | ${"strings are equal"}
            ${1}         | ${1}         | ${"numbers are equal"}
            ${true}      | ${true}      | ${"booleans are equal"}
            ${null}      | ${null}      | ${"nulls are equal"}
            ${undefined} | ${undefined} | ${"undefineds are equal"}
            ${null}      | ${undefined} | ${"null and undefined are passed"}
        `("should throw an error when $message", ({ actual, expected, message }) => {
            expect(() => {
                assert.notEqual(actual, expected, message);
            }).toThrow();
        });

        it.each`
            actual    | expected   | message
            ${"test"} | ${"test1"} | ${"strings are not equal"}
            ${1}      | ${2}       | ${"numbers are not equal"}
            ${true}   | ${false}   | ${"booleans are not equal"}
            ${[]}     | ${[]}      | ${"arrays are passed"}
            ${{}}     | ${{}}      | ${"objects are passed"}
        `("should not throw an error when $message", ({ actual, expected, message }) => {
            expect(() => {
                assert.notEqual(actual, expected, message);
            }).not.toThrow();
        });
    });
});
