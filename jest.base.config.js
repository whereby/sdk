module.exports = function buildConfig(_packageDirectory, pkgConfig) {
    return {
        preset: "ts-jest",
        testEnvironment: "jsdom",
        transform: {
            "^.+\\.(j|t)sx?$": ["ts-jest", { useESM: true }],
        },
        moduleNameMapper: {
            "@whereby.com/core": "<rootDir>/../core/dist/legacy-esm.js",
            "@whereby.com/media": "<rootDir>/../media/dist/legacy-esm.js",
        },
        roots: ["<rootDir>/src"],
        testMatch: ["<rootDir>/src/**/?(*.)+(spec|test|unit).[jt]s?(x)"],
        ...pkgConfig,
    };
};
