"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPmUpdate = exports.isYarn = exports.getPackageManagerUpdateCmd = exports.getPackageManagerInstallCmd = exports.getRunScriptCmd = exports.getPackageManager = exports.pmRunScriptCmd = exports.pmUpdateCmd = exports.pmInstallCmd = exports.pmMarkFiles = void 0;
var child_process_1 = require("child_process");
var fs = __importStar(require("fs-extra"));
var path_1 = require("path");
var _1 = require(".");
exports.pmMarkFiles = {
    pnpm: ['pnpm-lock.yaml'],
    yarn: ['yarn.lock'],
    npm: ['package-lock.json'],
};
exports.pmInstallCmd = {
    pnpm: 'pnpm install',
    yarn: 'yarn',
    npm: 'npm install',
};
exports.pmUpdateCmd = {
    pnpm: 'pnpm update',
    yarn: 'yarn upgrade',
    npm: 'npm update',
};
exports.pmRunScriptCmd = {
    pnpm: 'pnpm',
    yarn: 'yarn',
    npm: 'npm run',
};
var defaultPm = 'npm';
exports.getPackageManager = function (cwd) {
    var pms = Object.keys(exports.pmMarkFiles);
    return (pms.reduce(function (found, pm) {
        return (found ||
            (exports.pmMarkFiles[pm].reduce(function (found, file) { return found || (fs.existsSync(path_1.join(cwd, file)) && pm); }, false) &&
                pm));
    }, false) || defaultPm);
};
exports.getRunScriptCmd = function (cwd) {
    return exports.pmInstallCmd[exports.getPackageManager(cwd)];
};
exports.getPackageManagerInstallCmd = function (cwd) {
    return exports.pmInstallCmd[exports.getPackageManager(cwd)];
};
exports.getPackageManagerUpdateCmd = function (cwd) {
    return exports.pmUpdateCmd[exports.getPackageManager(cwd)];
};
exports.isYarn = function (cwd) { return exports.getPackageManager(cwd) === 'yarn'; };
exports.runPmUpdate = function (workingDir, packages) {
    var pkgMgrCmd = __spreadArrays([exports.getPackageManagerUpdateCmd(workingDir)], packages).join(' ');
    console.log("Running " + pkgMgrCmd + " in " + workingDir);
    child_process_1.execSync(pkgMgrCmd, __assign({ cwd: workingDir }, _1.execLoudOptions));
};
//# sourceMappingURL=pm.js.map