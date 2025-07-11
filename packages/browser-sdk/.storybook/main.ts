import { dirname, join } from "path";
import type { StorybookConfig } from "@storybook/react-vite";
import dotenv from "dotenv";

dotenv.config({
    path: "../../.env",
});

function getAbsolutePath(value) {
    return dirname(require.resolve(join(value, "package.json")));
}

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],

    addons: [getAbsolutePath("@storybook/addon-links"), getAbsolutePath("@storybook/addon-docs")],

    framework: getAbsolutePath("@storybook/react-vite"),

    core: {
        builder: getAbsolutePath("@storybook/builder-vite"),
    },
};

export default config;
