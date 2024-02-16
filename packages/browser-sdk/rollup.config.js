/* eslint-disable @typescript-eslint/no-var-requires */
const nodeResolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const replace = require("@rollup/plugin-replace");
const { terser } = require("rollup-plugin-terser");
const pkg = require("./package.json");
const typescript = require("rollup-plugin-typescript2");
const { dts } = require("rollup-plugin-dts");
const nodePolyfills = require("rollup-plugin-polyfill-node");

const baseConfig = require("../../rollup.base.config");
const replaceValues = baseConfig(__dirname, {}).replaceValues;

const peerDependencies = [...Object.keys(pkg.peerDependencies || {})];
const dependencies = [...Object.keys(pkg.dependencies || {})];

function makeCdnFilename(package) {
    const major = pkg.version.split(".")[0];

    let tag = "";
    const preRelease = pkg.version.split("-")[1];
    if (preRelease) {
        tag = `-${preRelease.split(".")[0]}`;
    }

    let packagePart = "";
    if (package) {
        packagePart = `-${package}`;
    }

    return `v${major}${packagePart}${tag}.js`;
}

const tsOptions = {
    tsconfig: "tsconfig.build.json",
};
const external = [/^@whereby\.com/, ...dependencies, ...peerDependencies];

const plugins = [replace(replaceValues), typescript(tsOptions)];

module.exports = [
    // Esm build of lib, to be used with bundlers
    {
        input: "src/lib/react/index.ts",
        output: {
            exports: "named",
            file: "dist/react/index.esm.js",
            format: "esm",
        },
        external,
        plugins,
    },
    {
        input: "src/lib/embed/index.ts",
        output: {
            exports: "named",
            file: "dist/embed/index.esm.js",
            format: "esm",
        },
        external,
        plugins,
    },

    // CDN builds
    {
        input: "src/lib/embed/index.ts",
        output: {
            file: `dist/cdn/${makeCdnFilename("embed")}`,
            format: "iife",
            name: "whereby",
        },
        plugins: [
            commonjs(), // Needs to come before `nodePolyfills`
            nodePolyfills(),
            nodeResolve({ browser: true, preferBuiltins: true }),
            json(),
            terser(),
            replace(replaceValues),
            typescript(tsOptions),
        ],
    },
    {
        input: "src/lib/react/index.ts",
        output: {
            file: `dist/cdn/${makeCdnFilename("react")}`,
            format: "iife",
            name: "whereby.react",
            globals: {
                react: "React",
            },
        },
        external: [...peerDependencies],
        plugins: [
            commonjs(), // Needs to come before `nodePolyfills`
            nodePolyfills(),
            nodeResolve({ browser: true, preferBuiltins: false }),
            json(),
            terser(),
            replace(replaceValues),
            typescript(tsOptions),
        ],
    },

    // Type definitions
    {
        input: "src/lib/react/index.ts",
        output: [{ file: "dist/react/index.d.ts", format: "es" }],
        external,
        plugins: [dts(tsOptions)],
    },
    {
        input: "src/lib/embed/index.ts",
        output: [{ file: "dist/embed/index.d.ts", format: "es" }],
        external,
        plugins: [dts(tsOptions)],
    },
];
