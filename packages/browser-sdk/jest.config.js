// eslint-disable-next-line @typescript-eslint/no-var-requires
const buildConfig = require("../../jest.base.config");

module.exports = buildConfig(__dirname, {
    testMatch: ["<rootDir>/src/**/?(*.)+(spec|test|unit).[jt]s?(x)"],
    transformIgnorePatterns: ["node_modules/(?!(@whereby/jslib-media)/)"],
    roots: ["<rootDir>/src"],
});
