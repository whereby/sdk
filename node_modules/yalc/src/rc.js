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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRcConfig = void 0;
var fs_1 = __importDefault(require("fs"));
var ini = require('ini');
var validFlags = [
    'sig',
    'workspace-resolve',
    'dev-mod',
    'scripts',
    'quiet',
    'files',
];
var fileName = '.yalcrc';
var readFile = function () {
    if (fs_1.default.existsSync(fileName)) {
        return ini.parse(fs_1.default.readFileSync(fileName, 'utf-8'));
    }
    return null;
};
exports.readRcConfig = function () {
    var rcOptions = readFile();
    if (!rcOptions)
        return {};
    var unknown = Object.keys(rcOptions).filter(function (key) { return !validFlags.includes(key); });
    if (unknown.length) {
        console.warn("Unknown option in " + fileName + ": " + unknown[0]);
        process.exit();
    }
    return Object.keys(rcOptions).reduce(function (prev, flag) {
        var _a;
        return validFlags.includes(flag)
            ? __assign(__assign({}, prev), (_a = {}, _a[flag] = rcOptions[flag], _a)) : prev;
    }, {});
};
//# sourceMappingURL=rc.js.map