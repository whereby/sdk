// Source: https://github.com/browserify/commonjs-assert
// License: MIT

class AssertionError extends Error {
    actual: any;
    code: string;
    expected: any;
    operator: string;
    generatedMessage: any;

    constructor(options: any) {
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

function innerOk(fn: any, argLen: number, value: any, message: any) {
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

function innerFail(obj: any) {
    if (obj.message instanceof Error) throw obj.message;

    throw new AssertionError(obj);
}

// Pure assertion tests whether a value is truthy, as determined
// by !!value.
function ok(...args: any) {
    // @ts-ignore
    innerOk(ok, args.length, ...args);
}

const assert: {
    fail: (message?: string | Error) => void;
    ok: (value: any, message?: string | Error) => void;
    equal?: (actual: any, expected: any, message?: string | Error) => void;
    notEqual?: (actual: any, expected: any, message?: string | Error) => void;
} = {
    fail: (message?: string | Error) => {
        innerFail({
            actual: "fail()",
            expected: "fail() should not be called",
            message,
            operator: "fail",
            stackStartFn: assert.fail,
        });
    },
    ok,
};

assert.notEqual = function notEqual(actual: any, expected: any, message: any) {
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

export default assert;
