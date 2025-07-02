/* eslint-disable @typescript-eslint/no-var-requires */
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const replace = require("@rollup/plugin-replace");
const nodeResolve = require("@rollup/plugin-node-resolve");
const pkg = require("./package.json");
const { dts } = require("rollup-plugin-dts");
const dotenv = require("dotenv");

dotenv.config({
    path: `../../.env`,
});

const baseConfig = require("@whereby.com/rollup-config/base");
const replaceValues = baseConfig(__dirname, {}).replaceValues;

const peerDependencies = [...Object.keys(pkg.peerDependencies || {})];
const dependencies = [...Object.keys(pkg.dependencies || {})];
const external = [...dependencies, ...peerDependencies];

const tsOptions = {
    tsconfig: "tsconfig.build.json",
};

const plugins = [
    replace(replaceValues),
    nodeResolve({
        // only include rtcstats in our bundle
        preferBuiltins: true,
        resolveOnly: [/rtcstats/],
    }),
    commonjs(),
    typescript(tsOptions),
];

module.exports = [
    // index and utils need to be built separately to avoid rollup code splitting (which breaks the .mjs and .cjs extensions)
    // Esm build of lib, to be used with bundlers
    {
        input: "src/index.ts",
        output: [
            {
                format: "esm",
                file: "dist/index.mjs",
                exports: "named",
            },
        ],
        plugins,
        external,
    },
    // Legacy Esm build of lib, to be used with older bundlers
    {
        input: "src/index.ts",
        output: [
            {
                format: "es",
                file: "dist/legacy-esm.js",
                exports: "named",
            },
        ],
        plugins,
        external,
    },
    // Cjs build of lib
    {
        input: "src/index.ts",
        output: [
            {
                format: "cjs",
                file: "dist/index.cjs",
                exports: "named",
            },
        ],
        plugins,
        external,
    },
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.mts", format: "esm" }],
        external,
        plugins: [dts(tsOptions)],
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
];
