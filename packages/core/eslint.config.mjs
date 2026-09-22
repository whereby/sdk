import baseConfig from "@whereby.com/eslint-config/base";
import browserGlobalsConfig from "@whereby.com/eslint-config/browser-globals";

/** @type {import('typescript-eslint').Config} */
export default [...baseConfig, ...browserGlobalsConfig];
