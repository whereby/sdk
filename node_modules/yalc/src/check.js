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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkManifest = void 0;
var fs = __importStar(require("fs-extra"));
var child_process_1 = require("child_process");
var path = __importStar(require("path"));
var path_1 = require("path");
var _1 = require(".");
var stagedChangesCmd = 'git diff --cached --name-only';
var isPackageManifest = function (fileName) {
    return path.basename(fileName) === 'package.json';
};
function checkManifest(options) {
    var findLocalDepsInManifest = function (manifestPath) {
        var pkg = fs.readJSONSync(manifestPath);
        var addresMatch = new RegExp("^(file|link):(.\\/)?\\" + _1.values.yalcPackagesFolder + "\\/");
        var findDeps = function (depsMap) {
            return Object.keys(depsMap).filter(function (name) { return depsMap[name].match(addresMatch); });
        };
        var localDeps = findDeps(pkg.dependencies || {}).concat(findDeps(pkg.devDependencies || {}));
        return localDeps;
    };
    if (options.commit) {
        child_process_1.execSync(stagedChangesCmd, __assign({ cwd: options.workingDir }, _1.execLoudOptions))
            .toString()
            .trim();
        child_process_1.execSync(stagedChangesCmd, __assign({ cwd: options.workingDir }, _1.execLoudOptions))
            .toString()
            .trim()
            .split('\n')
            .filter(isPackageManifest);
    }
    var manifestPath = path_1.join(options.workingDir, 'package.json');
    var localDeps = findLocalDepsInManifest(manifestPath);
    if (localDeps.length) {
        console.info('Yalc dependencies found:', localDeps);
        process.exit(1);
    }
}
exports.checkManifest = checkManifest;
//# sourceMappingURL=check.js.map