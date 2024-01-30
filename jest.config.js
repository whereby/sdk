module.exports = {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/tests/**/?(*.)+(spec|test).[jt]s?(x)"],
    roots: ["<rootDir>"],
    coverageDirectory: "test-report/unit-tests",
};
