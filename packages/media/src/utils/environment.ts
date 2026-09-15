/**
 * `typeof window !== "undefined"` is true under the Node SDK, which polyfills a partial `window`
 * for rtcstats. These return the global rather than a boolean, so the guard and the use are one
 * expression. For behaviour that differs because the caller *is* the Node SDK, use `isNodeSdk`.
 */

type MaybeBrowserGlobals = {
    window?: (Window & typeof globalThis) | undefined;
};

const globals = globalThis as MaybeBrowserGlobals;

/** `window`, but only in a real browsing context. Probes `document`, which the polyfill and RN lack. */
export function browserWindow(): (Window & typeof globalThis) | undefined {
    const candidate = globals.window;
    return candidate?.document ? candidate : undefined;
}

/**
 * Any `window`, real or polyfilled — for code the Node SDK's fake window deliberately serves, like
 * rtcstats.
 */
export function anyWindow(): (Window & typeof globalThis) | undefined {
    return globals.window;
}

/** `document`, but only in a real browsing context. */
export function browserDocument(): Document | undefined {
    return browserWindow()?.document;
}
