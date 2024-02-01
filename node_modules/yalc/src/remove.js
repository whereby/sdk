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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePackages = void 0;
var fs = __importStar(require("fs-extra"));
var path_1 = require("path");
var installations_1 = require("./installations");
var lockfile_1 = require("./lockfile");
var _1 = require(".");
var isYalcFileAddress = function (address, name) {
    var regExp = new RegExp('file|link:' + _1.values.yalcPackagesFolder + '/' + name);
    return regExp.test(address);
};
var removeIfEmpty = function (folder) {
    var isEmpty = fs.existsSync(folder) && !fs.readdirSync(folder).length;
    if (isEmpty) {
        fs.removeSync(folder);
    }
    return isEmpty;
};
exports.removePackages = function (packages, options) { return __awaiter(void 0, void 0, void 0, function () {
    var workingDir, lockFileConfig, pkg, packagesToRemove, lockfileUpdated, removedPackagedFromManifest, installationsToRemove, yalcFolder, isScopedPackage, isEmptyLockFile;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                workingDir = options.workingDir;
                lockFileConfig = lockfile_1.readLockfile({ workingDir: workingDir });
                pkg = _1.readPackageManifest(workingDir);
                if (!pkg)
                    return [2 /*return*/];
                packagesToRemove = [];
                if (packages.length) {
                    packages.forEach(function (packageName) {
                        var _a = _1.parsePackageName(packageName), name = _a.name, version = _a.version;
                        if (lockFileConfig.packages[name]) {
                            if (!version || version === lockFileConfig.packages[name].version) {
                                packagesToRemove.push(name);
                            }
                        }
                        else {
                            console.warn("Package " + packageName + " not found in " + _1.values.lockfileName +
                                ", still will try to remove.");
                            packagesToRemove.push(name);
                        }
                    });
                }
                else {
                    if (options.all) {
                        packagesToRemove = Object.keys(lockFileConfig.packages);
                    }
                    else {
                        console.info("Use --all option to remove all packages.");
                    }
                }
                lockfileUpdated = false;
                removedPackagedFromManifest = [];
                packagesToRemove.forEach(function (name) {
                    var lockedPackage = lockFileConfig.packages[name];
                    var depsWithPackage;
                    if (pkg.dependencies && pkg.dependencies[name]) {
                        depsWithPackage = pkg.dependencies;
                    }
                    if (pkg.devDependencies && pkg.devDependencies[name]) {
                        depsWithPackage = pkg.devDependencies;
                    }
                    if (depsWithPackage && isYalcFileAddress(depsWithPackage[name], name)) {
                        removedPackagedFromManifest.push(name);
                        if (lockedPackage && lockedPackage.replaced) {
                            depsWithPackage[name] = lockedPackage.replaced;
                        }
                        else {
                            delete depsWithPackage[name];
                        }
                    }
                    if (!options.retreat) {
                        lockfileUpdated = true;
                        delete lockFileConfig.packages[name];
                    }
                    else {
                        console.log("Retreating package " + name + " version ==>", lockedPackage.replaced);
                    }
                });
                if (lockfileUpdated) {
                    lockfile_1.writeLockfile(lockFileConfig, { workingDir: workingDir });
                }
                if (removedPackagedFromManifest.length) {
                    _1.writePackageManifest(workingDir, pkg);
                }
                installationsToRemove = packagesToRemove.map(function (name) { return ({
                    name: name,
                    version: '',
                    path: workingDir,
                }); });
                yalcFolder = path_1.join(workingDir, _1.values.yalcPackagesFolder);
                removedPackagedFromManifest.forEach(function (name) {
                    fs.removeSync(path_1.join(workingDir, 'node_modules', name));
                });
                packagesToRemove.forEach(function (name) {
                    if (!options.retreat) {
                        fs.removeSync(path_1.join(yalcFolder, name));
                    }
                });
                isScopedPackage = function (name) { return name.startsWith('@'); };
                packagesToRemove
                    .filter(isScopedPackage)
                    .map(function (name) { return name.split('/')[0]; })
                    .map(function (name) { return path_1.join(yalcFolder, name); })
                    .map(removeIfEmpty);
                isEmptyLockFile = !Object.keys(lockFileConfig.packages).length;
                if (isEmptyLockFile && !options.retreat) {
                    lockfile_1.removeLockfile({ workingDir: workingDir });
                    if (!removeIfEmpty(yalcFolder)) {
                        console.warn(yalcFolder, 'is not empty, not removing it.');
                    }
                }
                if (!!options.retreat) return [3 /*break*/, 2];
                return [4 /*yield*/, installations_1.removeInstallations(installationsToRemove)];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=remove.js.map