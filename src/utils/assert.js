// Source: https://github.com/browserify/commonjs-assert
// License: MIT

class AssertionError extends Error {
    constructor(options) {
        super(options.message);

        this.name = "AssertionError";
        this.code = "ERR_ASSERTION";
        this.actual = options.actual;
        this.expected = options.expected;
        this.operator = options.operator;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, options.stackStartFn);
        }
    }
}

function innerOk(fn, argLen, value, message) {
    if (!value) {
        let generatedMessage = false;

        if (argLen === 0) {
            generatedMessage = true;
            message = "No value argument passed to `assert.ok()`";
        } else if (message instanceof Error) {
            throw message;
        }

        const err = new AssertionError({
            actual: value,
            expected: true,
            message,
            operator: "==",
            stackStartFn: fn,
        });
        err.generatedMessage = generatedMessage;
        throw err;
    }
}

function innerFail(obj) {
    if (obj.message instanceof Error) throw obj.message;

    throw new AssertionError(obj);
}

// Pure assertion tests whether a value is truthy, as determined
// by !!value.
function ok(...args) {
    innerOk(ok, args.length, ...args);
}

const assert = ok;

assert.notEqual = function notEqual(actual, expected, message) {
    if (arguments.length < 2) {
        throw new Error("'actual' and 'expected' arguments are required");
    }
    // eslint-disable-next-line eqeqeq
    if (actual == expected) {
        innerFail({
            actual,
            expected,
            message,
            operator: "!=",
            stackStartFn: notEqual,
        });
    }
};

assert.ok = ok;

module.exports = assert;
