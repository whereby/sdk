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

const baseConfig = require("../../rollup.base.config");
const replaceValues = baseConfig(__dirname, {}).replaceValues;

const peerDependencies = [...Object.keys(pkg.peerDependencies || {})];

const plugins = [
    replace(replaceValues),
    replace({
        preventAssignment: true,
        // jslib-media uses global.navigator for some gUM calls, replace these
        delimiters: [" ", "."],
        values: { "global.navigator.mediaDevices": " navigator.mediaDevices." },
    }),
    nodeResolve({
        // only include @whereby/jslib-media and rtcstats in our bundle
        preferBuiltins: true,
        resolveOnly: [/@whereby\/jslib-media|rtcstats/],
    }),
    commonjs(),
    typescript({
        tsconfig: "tsconfig.build.json",
    }),
];

module.exports = [
    // Esm build of lib, to be used with bundlers
    {
        input: { index: "src/index.ts", utils: "src/utils/index.ts" },

        output: [
            {
                format: "esm", // set ES modules
                dir: "dist", // indicate not create a single-file
            },
        ],
        plugins,
        external: [...peerDependencies],
    },
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.ts", format: "es" }],
        external: ["@whereby/jslib-media/src/webrtc/RtcManager"],
        plugins: [dts()],
    },
    {
        input: "src/utils/index.ts",
        output: [{ file: "dist/utils.d.ts", format: "es" }],
        plugins: [dts()],
    },
];
