/* eslint-disable @typescript-eslint/no-var-requires */
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const replace = require("@rollup/plugin-replace");
const nodeResolve = require("@rollup/plugin-node-resolve");
const pkg = require("./package.json");
const { dts } = require("rollup-plugin-dts");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config({
    path: `../../.env`,
});

const baseConfig = require("@whereby.com/rollup-config/base");
const replaceValues = baseConfig(__dirname, {}).replaceValues;

const peerDependencies = [...Object.keys(pkg.peerDependencies || {})];
const dependencies = [...Object.keys(pkg.dependencies || {})];
const external = [...dependencies.filter((dep) => dep !== "events"), ...peerDependencies];

function makeCdnPath() {
    const major = pkg.version.split(".")[0];

    let tag = "";
    const preRelease = pkg.version.split("-")[1];
    if (preRelease) {
        tag = `-${preRelease.split(".")[0]}`;
    }

    return `v${major}${tag}`;
}

const copyAssetsToCdn = () => ({
    name: "copy-assets-to-cdn",
    async generateBundle() {
        const assetsDir = path.join(__dirname, "assets");
        const versionPath = makeCdnPath();
        const cdnAssetsDir = path.join(__dirname, "dist/cdn", versionPath, "assets");

        if (!fs.existsSync(cdnAssetsDir)) {
            fs.mkdirSync(cdnAssetsDir, { recursive: true });
        }

        const copyDir = (src, dest) => {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }

            const entries = fs.readdirSync(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                if (entry.isDirectory()) {
                    copyDir(srcPath, destPath);
                } else if (!entry.name.endsWith(".ts")) {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        };

        copyDir(assetsDir, cdnAssetsDir);
    },
    async writeBundle() {
        const virtualFile = path.join(__dirname, "dist/cdn/virtual-cdn-assets.js");
        if (fs.existsSync(virtualFile)) {
            fs.unlinkSync(virtualFile);
        }
    },
});

const tsOptions = {
    tsconfig: "tsconfig.build.json",
};

// Plugin to handle worker imports by making them external
const externalizeWorkers = () => ({
    name: "externalize-workers",
    resolveId(source) {
        if (source.includes(".worker.js") || source.includes(".worker.ts")) {
            return { id: source, external: true };
        }
        return null;
    },
});

// Plugin to externalize asset imports (they will be loaded from CDN)
const externalizeAssets = () => ({
    name: "externalize-assets",
    resolveId(source) {
        // Externalize asset imports with ?url suffix
        if (source.includes("?url") || source.match(/\.(wasm|tflite|jpg|png|mp4)$/)) {
            return { id: source, external: true };
        }
        // Also externalize the tflite.js and tflite-simd.js imports from assets
        if (source.includes("assets/tflite/tflite") && source.endsWith(".js")) {
            return { id: source, external: true };
        }
        return null;
    },
});

const plugins = [
    externalizeWorkers(),
    externalizeAssets(),
    replace(replaceValues),
    nodeResolve({
        preferBuiltins: false,
        browser: true,
        extensions: [".mjs", ".js", ".ts", ".json", ".node"],
    }),
    commonjs(),
    typescript(tsOptions),
];

module.exports = [
    // Main entry point - ESM build
    {
        input: "src/index.ts",
        output: [
            {
                format: "esm",
                file: "dist/index.mjs",
                exports: "named",
                inlineDynamicImports: true,
            },
        ],
        plugins: [...plugins],
        external,
    },

    // Legacy ESM build
    {
        input: "src/index.ts",
        output: [
            {
                format: "es",
                file: "dist/legacy-esm.js",
                exports: "named",
                inlineDynamicImports: true,
            },
        ],
        plugins,
        external,
    },

    // CommonJS build
    {
        input: "src/index.ts",
        output: [
            {
                format: "cjs",
                file: "dist/index.cjs",
                exports: "named",
                inlineDynamicImports: true,
            },
        ],
        plugins,
        external,
    },

    // Web Worker - ProcessorProxy worker
    {
        input: "src/pipelines/tfliteSegmentCanvasEffects/ProcessorProxy.worker.ts",
        output: [
            {
                format: "iife",
                file: "dist/workers/ProcessorProxy.worker.js",
            },
        ],
        external: (id) => {
            // Mark timer.worker as external, but not the entry point
            if (id.includes("timer.worker")) return true;
            // Also externalize assets
            if (id.includes("?url") || id.match(/\.(wasm|tflite|jpg|png|mp4)$/)) return true;
            if (id.includes("assets/tflite/tflite") && id.endsWith(".js")) return true;
            return false;
        },
        plugins: [
            externalizeAssets(),
            replace(replaceValues),
            nodeResolve({
                preferBuiltins: false,
                browser: true,
                extensions: [".mjs", ".js", ".ts", ".json", ".node"],
            }),
            commonjs(),
            typescript(tsOptions),
        ],
    },

    // Web Worker - Timer worker
    {
        input: "src/pipelines/timer.worker.ts",
        output: [
            {
                format: "iife",
                file: "dist/workers/timer.worker.js",
            },
        ],
        plugins: [
            externalizeAssets(),
            replace(replaceValues),
            nodeResolve({
                preferBuiltins: false,
                browser: true,
                extensions: [".mjs", ".js", ".ts", ".json", ".node"],
            }),
            commonjs(),
            typescript(tsOptions),
        ],
    },

    // CDN Assets - Copy assets to CDN
    {
        input: "virtual-cdn-assets",
        output: {
            dir: "dist/cdn",
            format: "esm",
        },
        plugins: [
            {
                name: "virtual-cdn-assets",
                resolveId(id) {
                    if (id === "virtual-cdn-assets") {
                        return id;
                    }
                    return null;
                },
                load(id) {
                    if (id === "virtual-cdn-assets") {
                        return "export default null;";
                    }
                    return null;
                },
            },
            copyAssetsToCdn(),
        ],
    },

    // Type definitions - ESM
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.mts", format: "esm" }],
        external,
        plugins: [dts(tsOptions)],
    },

    // Type definitions - ES
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.ts", format: "es" }],
        external,
        plugins: [dts(tsOptions)],
    },

    // Type definitions - CJS
    {
        input: "src/index.ts",
        output: [{ file: "dist/index.d.cts", format: "cjs" }],
        external,
        plugins: [dts(tsOptions)],
    },
];
