// eslint-disable-next-line @typescript-eslint/no-var-requires
const buildConfig = require("../../jest.base.config");

module.exports = buildConfig(__dirname, {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/tests/**/?(*.)+(spec|test).[jt]s?(x)"],
    transform: {
        "^.+\\.(j|t)sx?$": "ts-jest",
    },
    roots: ["<rootDir>"],
    coverageDirectory: "test-report/unit-tests",
});
