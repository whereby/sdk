// eslint-disable-next-line @typescript-eslint/no-var-requires
const buildConfig = require("../../jest.base.config");

module.exports = buildConfig(__dirname, {
    transformIgnorePatterns: ["<rootDir>/../../node_modules/(?!@whereby/jslib-media).+\\.js$"],
    moduleNameMapper: {
        "^@whereby/jslib-media$": "<rootDir>/../../node_modules/@whereby/jslib-media",
    },
});
