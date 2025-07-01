import buildConfig from "@whereby.com/jest-config/base";

export default buildConfig(__dirname, {
    modulePathIgnorePatterns: ["<rootDir>/lib/"],
});
