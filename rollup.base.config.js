module.exports = function buildConfig(packageDirectory, pkgConfig) {
    const pkg = require(`${packageDirectory}/package.json`);

    return {
        replaceValues: {
            preventAssignment: true,
            values: {
                __SDK_VERSION__: pkg.version,
                "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
                "process.env.NODE_DEBUG": JSON.stringify(process.env.NODE_DEBUG),
                "process.env.AWF_BASE_URL": JSON.stringify(process.env.AWF_BASE_URL),
                "process.env.AWF_API_BASE_URL": JSON.stringify(process.env.AWF_API_BASE_URL),
                "process.env.AP_ROOM_BASE_URL": JSON.stringify(process.env.AP_ROOM_BASE_URL),
                "process.env.RTCSTATS_URL": JSON.stringify(
                    process.env.RTCSTATS_URL || "wss://rtcstats.srv.whereby.com",
                ),
                "process.env.REACT_APP_API_BASE_URL": JSON.stringify(
                    process.env.REACT_APP_API_BASE_URL || "https://api.whereby.dev",
                ),
                "process.env.REACT_APP_SIGNAL_BASE_URL": JSON.stringify(
                    process.env.REACT_APP_SIGNAL_BASE_URL || "wss://signal.appearin.net",
                ),
                "process.env.REACT_APP_IS_DEV": JSON.stringify(process.env.REACT_APP_IS_DEV),
            },
        },
    };
};
