module.exports = {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/tests/**/?(*.)+(spec|test).[jt]s?(x)"],
    transform: {
        "^.+\\.(j|t)sx?$": "ts-jest",
    },
    roots: ["<rootDir>"],
    coverageDirectory: "test-report/unit-tests",
};
