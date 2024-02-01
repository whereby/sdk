"use strict";
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
exports.addPackageToLockfile = exports.writeLockfile = exports.readLockfile = exports.removeLockfile = void 0;
var fs = __importStar(require("fs-extra"));
var path_1 = require("path");
var _1 = require(".");
var determineLockFileVersion = function (lockfile) {
    if (lockfile.version == 'v1' && lockfile.packages) {
        return 'v1';
    }
    return 'v0';
};
var configTransformers = {
    v0: function (lockFile) {
        return {
            version: 'v1',
            packages: lockFile,
        };
    },
    v1: function (lockFile) { return lockFile; },
};
var getLockFileCurrentConfig = function (lockFileConfig) {
    var version = determineLockFileVersion(lockFileConfig);
    return configTransformers[version](lockFileConfig);
};
exports.removeLockfile = function (options) {
    var lockfilePath = path_1.join(options.workingDir, _1.values.lockfileName);
    fs.removeSync(lockfilePath);
};
exports.readLockfile = function (options) {
    var lockfilePath = path_1.join(options.workingDir, _1.values.lockfileName);
    var lockfile = {
        version: 'v1',
        packages: {},
    };
    try {
        lockfile = getLockFileCurrentConfig(fs.readJSONSync(lockfilePath));
    }
    catch (e) {
        return lockfile;
    }
    return lockfile;
};
exports.writeLockfile = function (lockfile, options) {
    var lockfilePath = path_1.join(options.workingDir, _1.values.lockfileName);
    var data = JSON.stringify(lockfile, null, 2);
    fs.writeFileSync(lockfilePath, data);
};
exports.addPackageToLockfile = function (packages, options) {
    var lockfile = exports.readLockfile(options);
    packages.forEach(function (_a) {
        var name = _a.name, version = _a.version, file = _a.file, link = _a.link, replaced = _a.replaced, signature = _a.signature, pure = _a.pure, workspace = _a.workspace;
        var old = lockfile.packages[name] || {};
        lockfile.packages[name] = {};
        if (version) {
            lockfile.packages[name].version = version;
        }
        if (signature) {
            lockfile.packages[name].signature = signature;
        }
        if (file) {
            lockfile.packages[name].file = true;
        }
        if (link) {
            lockfile.packages[name].link = true;
        }
        if (pure) {
            lockfile.packages[name].pure = true;
        }
        if (workspace) {
            lockfile.packages[name].workspace = true;
        }
        if (replaced || old.replaced) {
            lockfile.packages[name].replaced = replaced || old.replaced;
        }
    });
    exports.writeLockfile(lockfile, options);
};
//# sourceMappingURL=lockfile.js.map