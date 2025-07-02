import path from "node:path";
import buildConfig from "@whereby.com/jest-config/base";

const __dirname = path.resolve();

export default buildConfig(__dirname, {
    modulePathIgnorePatterns: ["<rootDir>/lib/"],
});
