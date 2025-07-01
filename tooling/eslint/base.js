import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["**/*.config.*"] },
    {
        files: ["**/*.js", "**/*.ts", "**/*.tsx"],
        plugins: {
            import: importPlugin,
            turbo: turboPlugin,
        },
        extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
        rules: {
            ...turboPlugin.configs.recommended.rules,
            "no-console": ["error", { allow: ["warn", "error"] }],
            "@typescript-eslint/ban-ts-comment": 0,
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-empty-interface": "off",
            "@typescript-eslint/no-empty-function": "off",
        },
    },
    {
        linterOptions: { reportUnusedDisableDirectives: true },
        languageOptions: { parserOptions: { projectService: true } },
    },
);
