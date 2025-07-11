// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import baseConfig from "@whereby.com/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [...baseConfig, ...storybook.configs["flat/recommended"]];
