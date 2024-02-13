declare module "heresy" {
    interface AttrChanged {
        attributeName: string;
        oldValue: string | boolean;
    }

    interface element {
        observedAttributes?: string[];
        onattributechanged?: (attrChanged: AttrChanged) => void;
        onconnected?: () => void;
        ondisconnected?: () => void;
        oninit?: () => void;
        render: () => void;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [x: string]: any;
    }

    export function define(elementName: string, element: element): void;
    export function ref(): boolean;
}

declare const assert: {
    (value: unknown, message?: string | Error): asserts value;
    ok(value: unknown, message?: string | Error): asserts value;
    notEqual<T>(actual: T, expected: T, message: string): void;
};
