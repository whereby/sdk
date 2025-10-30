/* eslint-disable @typescript-eslint/no-var-requires */
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const replace = require("@rollup/plugin-replace");
const nodeResolve = require("@rollup/plugin-node-resolve");
const url = require("@rollup/plugin-url");
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
const external = [...dependencies, ...peerDependencies];

const tsOptions = {
    tsconfig: "tsconfig.build.json",
};

// Plugin to handle binary assets (WASM, images, videos, models)
const assetPlugin = url({
    include: ["**/*.wasm", "**/*.tflite", "**/*.jpg", "**/*.png", "**/*.mp4"],
    limit: 0, // Never inline, always emit as separate files
    fileName: "assets/[dirname][name][extname]",
    publicPath: "./",
});

// Plugin to resolve .js imports to .ts files in assets directory
const resolveJsToTs = () => ({
    name: "resolve-js-to-ts",
    resolveId(source, importer) {
        if (source.endsWith(".js") && source.includes("assets/tflite")) {
            const tsPath = source.replace(/\.js$/, ".ts");
            return path.resolve(path.dirname(importer || __dirname), tsPath);
        }
        return null;
    },
});

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

const plugins = [
    externalizeWorkers(),
    resolveJsToTs(),
    assetPlugin,
    replace(replaceValues),
    nodeResolve({
        preferBuiltins: true,
        extensions: [".mjs", ".js", ".ts", ".json", ".node"],
    }),
    commonjs(),
    typescript(tsOptions),
];

// Plugin to copy assets to dist folder
const copyAssets = () => ({
    name: "copy-assets",
    writeBundle() {
        const assetsDir = path.join(__dirname, "assets");
        const distDir = path.join(__dirname, "dist", "assets");

        // Recursively copy directory
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
                } else if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) {
                    // Skip .ts and .js files - they should be handled by rollup
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        };

        if (fs.existsSync(assetsDir)) {
            copyDir(assetsDir, distDir);
            console.log("✓ Copied assets to dist/assets");
        }
    },
});

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
        plugins: [...plugins, copyAssets()],
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
            return id.includes("timer.worker");
        },
        plugins: [
            resolveJsToTs(),
            assetPlugin,
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
            resolveJsToTs(),
            assetPlugin,
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
