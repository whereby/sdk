/* eslint-env node */
const webpack = require("webpack");
const path = require("path");

module.exports = function(config) {
    config.set({
        basePath: "../",
        port: 9100,

        frameworks: ["mocha"],
        reporters: ["progress", "coverage-istanbul"],

        preprocessors: {
            "src/**/*.js": ["webpack"],
            "tests/**/*.js": ["webpack"],
        },
        files: ["src/**/*.js", "tests/**/*.js"],

        browsers: ["ChromeHeadless"],
        browserNoActivityTimeout: 60000,
        captureTimeout: 15000,

        colors: true,
        logLevel: config.LOG_INFO,
        singleRun: true,
        concurrency: Infinity,

        coverageIstanbulReporter: {
            reports: ["html"],
            dir: path.resolve(__dirname, "../test-report/"),
            fixWebpackSourcePaths: true,
            skipFilesWithNoCoverage: false,
            "report-config": {
                html: {
                    subdir: "coverage-html",
                },
            },
        },

        webpack: {
            devtool: "cheap-module-source-map",
            plugins: [
                new webpack.DefinePlugin({
                    "process.env.AWF_BASE_URL": "'AWF_BASE_URL/'",
                    "process.env.AWF_API_BASE_URL": "'AWF_API_BASE_URL/'",
                    "process.env.AP_ROOM_BASE_URL": "'AP_ROOM_BASE_URL/'",
                }),
                new webpack.ProvidePlugin({ process: "process/browser" }),
            ],
            resolve: { fallback: { assert: require.resolve("assert") } },
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: {
                            loader: "babel-loader",
                            options: {
                                presets: [["@babel/preset-env", { exclude: ["transform-regenerator"] }]],
                                plugins: ["rewire-exports"],
                            },
                        },
                    },
                    {
                        test: /\.js$/,
                        include: path.resolve(__dirname, "../src/"),
                        loader: "istanbul-instrumenter-loader",
                        enforce: "post",
                        options: {
                            esModules: true,
                        },
                    },
                ],
            },
        },
        webpackMiddleware: {
            stats: {
                chunkModules: false,
                colors: true,
            },
        },
    });
};
