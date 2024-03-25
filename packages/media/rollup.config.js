/* eslint-disable @typescript-eslint/no-var-requires */
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const replace = require("@rollup/plugin-replace");
const pkg = require("./package.json");
const { dts } = require("rollup-plugin-dts");

const dependencies = [...Object.keys(pkg.dependencies || {})];
const peerDependencies = [...Object.keys(pkg.peerDependencies || {})];

const tsOptions = {
    tsconfig: "tsconfig.build.json",
};

const plugins = [
    replace({
        preventAssignment: true,
        // jslib-media uses global.navigator for some gUM calls, replace these
        delimiters: [" ", "."],
        values: { "global.navigator.mediaDevices": " navigator.mediaDevices." },
    }),
    commonjs(),
    typescript(tsOptions),
];

const external = [...dependencies, ...peerDependencies];

module.exports = [
    // Esm build of lib, to be used with bundlers
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.esm.js",
            format: "esm",
            exports: "named",
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
];
