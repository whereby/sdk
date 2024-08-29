module.exports = {
    env: {
        browser: true,
        es6: true,
        jest: true,
        node: true,
    },
    ignorePatterns: ["dist/*"],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
            experimentalObjectRestSpread: true,
        },
    },
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    plugins: ["jest"],
    rules: {
        "no-console": ["error", { allow: ["warn", "error"] }],
        "@typescript-eslint/ban-ts-comment": 0,
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/no-empty-function": "off",
    },
};
