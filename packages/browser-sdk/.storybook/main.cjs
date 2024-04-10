const {
    dirname,
    join
} = require("path");

const dotenv = require("dotenv");

dotenv.config({
    path: "../../.env",
});

module.exports = {
    stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
    addons: [
        getAbsolutePath("@storybook/addon-links"),
        getAbsolutePath("@storybook/addon-essentials"),
        "@storybook/addon-webpack5-compiler-babel"
    ],
    framework: "@storybook/react",

    webpackFinal: async (config) => {
        config.module.rules.push({
            resolve: {
                fullySpecified: false,
                extensions: [".js", ".ts", ".tsx"],
            },
        });

        return config;
    },

    framework: {
        name: getAbsolutePath("@storybook/react-webpack5"),
        options: {},
    },
    env: (config) => ({
        ...config,
        REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
        REACT_APP_SIGNAL_BASE_URL: process.env.REACT_APP_SIGNAL_BASE_URL,
        STORYBOOK_ROOM: process.env.STORYBOOK_ROOM,
        REACT_APP_IS_DEV: process.env.REACT_APP_IS_DEV,
    }),
    docs: {
        autodocs: true,
    },
};

function getAbsolutePath(value) {
    return dirname(require.resolve(join(value, "package.json")));
}
