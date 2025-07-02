module.exports = {
    source: "src",
    output: "dist",
    targets: [
        [
            "commonjs",
            {
                esm: false,
            },
        ],
        [
            "module",
            {
                esm: true,
            },
        ],
        [
            "typescript",
            {
                project: "tsconfig.build.json",
                esm: true,
            },
        ],
    ],
};
