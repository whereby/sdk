const dotenv = require("dotenv");

dotenv.config({
    path: "../../.env",
});

module.exports = {
    stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
    addons: ["@storybook/addon-links", "@storybook/addon-essentials"],
    framewkork: "@storybook/react",

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
        name: "@storybook/react-webpack5",
        options: {},
    },
    env: (config) => ({
        ...config,
        REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
        REACT_APP_SIGNAL_BASE_URL: process.env.REACT_APP_SIGNAL_BASE_URL,
        STORYBOOK_ROOM: process.env.STORYBOOK_ROOM,
    }),
    docs: {
        autodocs: true,
    },
};
