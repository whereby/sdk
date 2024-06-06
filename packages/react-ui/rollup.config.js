/* eslint-disable @typescript-eslint/no-var-requires */
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const pkg = require("./package.json");
const { dts } = require("rollup-plugin-dts");

const dependencies = [...Object.keys(pkg.dependencies || {})];
const peerDependencies = [...Object.keys(pkg.peerDependencies || {})];

const tsOptions = {
    tsconfig: "tsconfig.build.json",
};

const plugins = [commonjs(), typescript(tsOptions)];

const external = [...dependencies, ...peerDependencies];

module.exports = [
    // Esm build of lib, to be used with bundlers
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.mjs",
            format: "esm",
            exports: "named",
        },
        plugins,
        external,
    },
    // Legacy Esm build of lib, to be used with older bundlers
    {
        input: "src/index.ts",
        output: {
            file: "dist/legacy-esm.js",
            format: "es",
            exports: "named",
            sourcemap: true,
        },
        plugins,
        external,
    },
    // CommonJS build of lib, to be used in commonjs apps
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.cjs",
            format: "cjs",
            exports: "named",
            sourcemap: true,
        },
        plugins,
        external,
    },
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.ts", format: "es" }],
        external,
        plugins: [dts(tsOptions)],
    },
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.cts", format: "cjs" }],
        external,
        plugins: [dts(tsOptions)],
    },
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.mts", format: "esm" }],
        external,
        plugins: [dts(tsOptions)],
    },
];
