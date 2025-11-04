import path from "node:path";
import buildConfig from "@whereby.com/jest-config/base";

const __dirname = path.resolve();

export default buildConfig(__dirname, {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/tests/**/?(*.)+(spec|test).[jt]s?(x)", "<rootDir>/src/**/?(*.)+(spec|test|unit).[jt]s?(x)"],
    transform: {
        "^.+\\.(j|t)sx?$": "ts-jest",
    },
    moduleNameMapper: {
        "^mediasoup-client/lib/(.*)$": "<rootDir>/../../node_modules/mediasoup-client/lib/$1",
    },
    roots: ["<rootDir>"],
    coverageDirectory: "test-report/unit-tests",
});
