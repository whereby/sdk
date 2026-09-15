/**
 * Bans `typeof window|document|navigator|self` guards, which pass against the partial `window` the
 * Node SDK polyfills and then throw.
 */
const typeofGuard = {
    selector:
        'BinaryExpression[operator=/^[!=]==?$/]:has(> UnaryExpression[operator="typeof"]:has(> Identifier[name=/^(window|document|navigator|self)$/]))',
    message:
        "A `typeof window|document|navigator|self` guard does not prove a browsing context: the Node SDK polyfills a partial `window`, and SSR and React Native define some of these too. Use `browserWindow()` / `browserDocument()` from @whereby.com/media so the check and the use are one expression, or add an eslint-disable with a one-line reason.",
};

/**
 * `navigator` and `self` at module scope. Not banned inside functions: the Node SDK polyfill
 * defines `navigator.userAgent` and `navigator.mediaDevices` on purpose, and media and core
 * depend on that, banning them outright would flag working code and break the Node SDK.
 */
const moduleScopeAccess = {
    selector:
        "MemberExpression[object.name=/^(navigator|self)$/]:not(FunctionDeclaration MemberExpression, FunctionExpression MemberExpression, ArrowFunctionExpression MemberExpression, PropertyDefinition MemberExpression)",
    message:
        "This runs at import time, in every environment that imports the package, so there is no browser-only call path to rely on. Move it into the function that needs it, or add an eslint-disable with a one-line reason.",
};

/**
 * `window` and `document` at any scope. Neither exists in the Node SDK, SSR or React Native,
 * unlike `navigator`, the polyfill does not provide them, so any use is a browser-only path.
 */
const browserOnlyAccess = {
    selector: "MemberExpression[object.name=/^(window|document)$/]",
    message:
        "`window` and `document` do not exist outside a browsing context. Use `browserWindow()` / `browserDocument()` from @whereby.com/media, or if this module is browser-only by design, disable the rule at the top of the file with a one-line reason.",
};

const FILES = ["**/*.js", "**/*.ts", "**/*.tsx"];
const TESTS = ["**/*.spec.*", "**/*.test.*", "**/__tests__/**", "**/tests/**"];

export default [
    // Tests get the typeof rule only, an import-time crash there fails the run immediately, and
    // module-scope browser globals are normal under jsdom.
    { files: FILES, rules: { "no-restricted-syntax": ["error", typeofGuard] } },
    {
        files: FILES,
        ignores: TESTS,
        rules: { "no-restricted-syntax": ["error", typeofGuard, moduleScopeAccess, browserOnlyAccess] },
    },
];
