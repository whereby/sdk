/* eslint-disable @typescript-eslint/no-var-requires */
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const replace = require("@rollup/plugin-replace");
const nodeResolve = require("@rollup/plugin-node-resolve");
const webWorkerLoader = require("rollup-plugin-web-worker-loader");
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
    const minor = pkg.version.split(".")[1];
    const patch = pkg.version.split(".")[2];

    let tag = "";
    const preRelease = pkg.version.split("-")[1];
    if (preRelease) {
        tag = `-${preRelease.replace(/\./g, "-")}`;
    }

    return `v${major}-${minor}-${patch}${tag}`;
}

const CDN_BASE_URL = process.env.CDN_BASE_URL || "https://cdn.srv.whereby.com/camera-effects";

const IS_DEV = process.env.REACT_APP_IS_DEV === "true";

const createReplaceValues = () => ({
    preventAssignment: true,
    delimiters: ["", ""],
    values: {
        ...replaceValues.values,
        __ASSET_CDN_BASE_URL__: IS_DEV ? "" : `${CDN_BASE_URL}/${makeCdnPath()}`,
        __USE_CDN_ASSETS__: IS_DEV ? "false" : "true",
    },
});

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
    filter: (id) => !id.includes("rollup-plugin-worker-loader"),
};

const url = require("@rollup/plugin-url");

const wasmPlugin = url({
    include: ["**/*.wasm"],
    limit: 0,
    fileName: "assets/tflite/[name][extname]",
    publicPath: "./",
    destDir: path.join(__dirname, "dist"),
    emitFiles: true,
});

const tflitePlugin = url({
    include: ["**/*.tflite"],
    limit: 0,
    fileName: "assets/tflite/models/[name][extname]",
    publicPath: "./",
    destDir: path.join(__dirname, "dist"),
    emitFiles: true,
});

const imageAssetPlugin = url({
    include: ["**/*.jpg", "**/*.png", "**/*.mp4"],
    limit: 0,
    fileName: "assets/[dirname][name][extname]",
    publicPath: "./",
    destDir: path.join(__dirname, "dist"),
    emitFiles: true,
});

const handleUrlImports = () => ({
    name: "handle-url-imports",
    resolveId(source, importer) {
        if (source.includes("rollup-plugin-worker-loader")) {
            return null;
        }

        const baseDir = importer ? path.dirname(importer) : __dirname;

        if (source.includes("?url")) {
            const cleanSource = source.replace("?url", "");
            const resolved = path.resolve(baseDir, cleanSource);
            return resolved;
        }
        if (source.endsWith(".js") && source.includes("assets/tflite")) {
            const tsPath = source.replace(/\.js$/, ".ts");
            return path.resolve(baseDir, tsPath);
        }
        return null;
    },
});

const externalizeAssets = () => ({
    name: "externalize-assets",
    resolveId(source, importer) {
        if (source.includes("assets/") && !source.endsWith(".js") && !source.endsWith(".ts")) {
            return { id: source, external: true };
        }
        return null;
    },
});

const plugins = [
    ...(IS_DEV ? [handleUrlImports(), wasmPlugin, tflitePlugin, imageAssetPlugin] : [externalizeAssets()]),
    nodeResolve({
        preferBuiltins: false,
        browser: true,
        extensions: [".mjs", ".js", ".ts", ".json", ".node"],
    }),
    commonjs(),
    typescript(tsOptions),
    webWorkerLoader({
        extensions: ["js", "ts"],
        inline: true,
        targetPlatform: "browser",
    }),
    replace(createReplaceValues()),
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
        plugins,
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
