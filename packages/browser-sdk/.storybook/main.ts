import type { StorybookConfig } from "@storybook/react-vite";
import { join, dirname } from "path";
import dotenv from "dotenv";

dotenv.config({
    path: "../../.env",
});

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
    return dirname(require.resolve(join(value, "package.json")));
}
const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
    refs: {
        "react-ui": {
            title: "React UI",
            url: "http://localhost:6007",
        },
    },
    addons: [getAbsolutePath("@storybook/addon-links"), getAbsolutePath("@storybook/addon-essentials")],
    framework: {
        name: getAbsolutePath("@storybook/react-vite"),
        options: {},
    },
    docs: {
        autodocs: true,
    },
};
export default config;
