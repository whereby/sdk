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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyPackageToStore = exports.getFileHash = void 0;
var crypto_1 = __importDefault(require("crypto"));
var fs_extra_1 = __importDefault(require("fs-extra"));
var ignore_1 = __importDefault(require("ignore"));
var npm_packlist_1 = __importDefault(require("npm-packlist"));
var path_1 = require("path");
var _1 = require(".");
var _2 = require(".");
var shortSignatureLength = 8;
exports.getFileHash = function (srcPath, relPath) {
    if (relPath === void 0) { relPath = ''; }
    return new Promise(function (resolve, reject) { return __awaiter(void 0, void 0, void 0, function () {
        var stream, md5sum;
        return __generator(this, function (_a) {
            stream = fs_extra_1.default.createReadStream(srcPath);
            md5sum = crypto_1.default.createHash('md5');
            md5sum.update(relPath.replace(/\\/g, '/'));
            stream.on('data', function (data) { return md5sum.update(data); });
            stream.on('error', reject).on('close', function () {
                resolve(md5sum.digest('hex'));
            });
            return [2 /*return*/];
        });
    }); });
};
var copyFile = function (srcPath, destPath, relPath) {
    if (relPath === void 0) { relPath = ''; }
    return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs_extra_1.default.copy(srcPath, destPath)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, exports.getFileHash(srcPath, relPath)];
            }
        });
    });
};
var mapObj = function (obj, mapValue) {
    if (Object.keys(obj).length === 0)
        return {};
    return Object.keys(obj).reduce(function (resObj, key) {
        if (obj[key]) {
            resObj[key] = mapValue(obj[key], key);
        }
        return resObj;
    }, {});
};
var resolveWorkspaceDepVersion = function (version, pkgName, workingDir) {
    var _a;
    if (version !== '*' && version !== '^' && version !== '~') {
        // Regular semver specification
        return version;
    }
    // Resolve workspace version aliases
    var prefix = version === '^' || version === '~' ? version : '';
    try {
        var pkgPath = require.resolve(path_1.join(pkgName, 'package.json'), {
            paths: [workingDir],
        });
        if (!pkgPath) {
        }
        var resolved = (_a = _1.readPackageManifest(path_1.dirname(pkgPath))) === null || _a === void 0 ? void 0 : _a.version;
        return "" + prefix + resolved || '*';
    }
    catch (e) {
        console.warn('Could not resolve workspace package location for', pkgName);
        return '*';
    }
};
var resolveWorkspaces = function (pkg, workingDir) {
    var resolveDeps = function (deps) {
        return deps
            ? mapObj(deps, function (val, depPkgName) {
                if (val.startsWith('workspace:')) {
                    var version = val.split(':')[1];
                    var resolved = resolveWorkspaceDepVersion(version, depPkgName, workingDir);
                    console.log("Resolving workspace package " + depPkgName + " version ==> " + resolved);
                    return resolved;
                }
                return val;
            })
            : deps;
    };
    return __assign(__assign({}, pkg), { dependencies: resolveDeps(pkg.dependencies), devDependencies: resolveDeps(pkg.devDependencies), peerDependencies: resolveDeps(pkg.peerDependencies) });
};
var modPackageDev = function (pkg) {
    return __assign(__assign({}, pkg), { scripts: pkg.scripts
            ? __assign(__assign({}, pkg.scripts), { prepare: undefined, prepublish: undefined }) : undefined, devDependencies: undefined });
};
var fixScopedRelativeName = function (path) { return path.replace(/^\.\//, ''); };
exports.copyPackageToStore = function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var workingDir, _a, devMod, pkg, copyFromDir, storePackageStoreDir, ignoreFileContent, ignoreRule, npmList, filesToCopy, copyFilesToStore, hashes, _b, signature, publishedSig, versionPre, resolveDeps, pkgToWrite;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                workingDir = options.workingDir, _a = options.devMod, devMod = _a === void 0 ? true : _a;
                pkg = _1.readPackageManifest(workingDir);
                if (!pkg) {
                    throw 'Error copying package to store.';
                }
                copyFromDir = options.workingDir;
                storePackageStoreDir = path_1.join(_2.getStorePackagesDir(), pkg.name, pkg.version);
                ignoreFileContent = _1.readIgnoreFile(workingDir);
                ignoreRule = ignore_1.default().add(ignoreFileContent);
                return [4 /*yield*/, npm_packlist_1.default({ path: workingDir })];
            case 1: return [4 /*yield*/, (_c.sent()).map(fixScopedRelativeName)];
            case 2:
                npmList = _c.sent();
                filesToCopy = npmList.filter(function (f) { return !ignoreRule.ignores(f); });
                if (options.files) {
                    console.info('Files included in published content:');
                    filesToCopy.forEach(function (f) {
                        console.log("- " + f);
                    });
                    console.info("Total " + filesToCopy.length + " files.");
                }
                copyFilesToStore = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, fs_extra_1.default.remove(storePackageStoreDir)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/, Promise.all(filesToCopy
                                        .sort()
                                        .map(function (relPath) {
                                        return copyFile(path_1.join(copyFromDir, relPath), path_1.join(storePackageStoreDir, relPath), relPath);
                                    }))];
                        }
                    });
                }); };
                if (!options.changed) return [3 /*break*/, 4];
                return [4 /*yield*/, Promise.all(filesToCopy
                        .sort()
                        .map(function (relPath) { return exports.getFileHash(path_1.join(copyFromDir, relPath), relPath); }))];
            case 3:
                _b = _c.sent();
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, copyFilesToStore()];
            case 5:
                _b = _c.sent();
                _c.label = 6;
            case 6:
                hashes = _b;
                signature = crypto_1.default
                    .createHash('md5')
                    .update(hashes.join(''))
                    .digest('hex');
                if (!options.changed) return [3 /*break*/, 9];
                publishedSig = _1.readSignatureFile(storePackageStoreDir);
                if (!(signature === publishedSig)) return [3 /*break*/, 7];
                return [2 /*return*/, false];
            case 7: return [4 /*yield*/, copyFilesToStore()];
            case 8:
                _c.sent();
                _c.label = 9;
            case 9:
                _2.writeSignatureFile(storePackageStoreDir, signature);
                versionPre = options.signature
                    ? '+' + signature.substr(0, shortSignatureLength)
                    : '';
                resolveDeps = function (pkg) {
                    return options.workspaceResolve ? resolveWorkspaces(pkg, workingDir) : pkg;
                };
                pkgToWrite = __assign(__assign({}, resolveDeps(devMod ? modPackageDev(pkg) : pkg)), { yalcSig: signature, version: pkg.version + versionPre });
                _2.writePackageManifest(storePackageStoreDir, pkgToWrite);
                return [2 /*return*/, signature];
        }
    });
}); };
//# sourceMappingURL=copy.js.map