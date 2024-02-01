module.exports = function buildConfig(packageDirectory, pkgConfig) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageName = require(`${packageDirectory}/package.json`).name;

    return {
        preset: "ts-jest",
        testEnvironment: "jsdom",
        transform: {
            "^.+\\.(j|t)sx?$": "ts-jest",
        },
        displayName: packageName,
        ...pkgConfig,
    };
};
