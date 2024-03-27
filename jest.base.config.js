module.exports = function buildConfig(_packageDirectory, pkgConfig) {
    return {
        preset: "ts-jest",
        testEnvironment: "jsdom",
        transform: {
            "^.+\\.(j|t)sx?$": ["ts-jest", { useESM: true }],
        },
        moduleNameMapper: {
            "@whereby.com/core/utils": "<rootDir>/../core/dist/utils.js",
            "@whereby.com/core": "<rootDir>/../core/dist/index.js",
        },
        roots: ["<rootDir>/src"],
        testMatch: ["<rootDir>/src/**/?(*.)+(spec|test|unit).[jt]s?(x)"],
        transformIgnorePatterns: ["node_modules/(?!(@whereby/jslib-media)/)"],
        ...pkgConfig,
    };
};
