import baseConfig from "@whereby.com/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
    ...baseConfig,
    {
        rules: {
            "no-console": ["error", { allow: ["warn", "error"] }],
            "@typescript-eslint/ban-ts-comment": 0,
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/no-wrapper-object-types": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unsafe-function-type": "off",
            "@typescript-eslint/no-require-imports": "off",
            "prefer-spread": "off",
            "prefer-destructuring": "off",
            "prefer-rest-params": "off",
            "@typescript-eslint/no-var-requires": "off",
            "no-inner-declarations": "off",
            "no-unsafe-optional-chaining": "off",
            "no-prototype-builtins": "off",
            "no-case-declarations": "off",
            "no-empty": "off",
            "@typescript-eslint/ban-types": "off",
        },
    },
];
