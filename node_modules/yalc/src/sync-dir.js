"use strict";
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyDirSafe = void 0;
var glob_1 = __importDefault(require("glob"));
var util_1 = __importDefault(require("util"));
var path_1 = require("path");
var fs_extra_1 = __importDefault(require("fs-extra"));
var copy_1 = require("./copy");
var NODE_MAJOR_VERSION = parseInt(process.versions.node.split('.').shift(), 10);
if (NODE_MAJOR_VERSION >= 8 && NODE_MAJOR_VERSION < 10) {
    // Symbol.asyncIterator polyfill for Node 8 + 9
    ;
    Symbol.asyncIterator =
        Symbol.asyncIterator || Symbol('Symbol.asyncIterator');
}
var globP = util_1.default.promisify(glob_1.default);
var cache = {};
var makeListMap = function (list) {
    return list.reduce(function (map, item) {
        map[item] = true;
        return map;
    }, {});
};
var theSameStats = function (srcStat, destStat) {
    return (srcStat.mtime.getTime() === destStat.mtime.getTime() &&
        srcStat.size === destStat.size);
};
exports.copyDirSafe = function (srcDir, destDir, compareContent) {
    if (compareContent === void 0) { compareContent = true; }
    return __awaiter(void 0, void 0, void 0, function () {
        var ignore, dot, nodir, srcList, _a, destList, srcMap, destMap, newFiles, filesToRemove, commonFiles, filesToReplace, srcCached, dirsInDest, commonFiles_1, commonFiles_1_1, file, srcFilePath, destFilePath, srcFileStat, _b, destFileStat, areDirs, replacedFileWithDir, dirReplacedWithFile, compareByHash, _c, _d, _e, e_1_1, newFilesDirs;
        var e_1, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    ignore = '**/node_modules/**';
                    dot = true;
                    nodir = false;
                    if (!cache[srcDir]) return [3 /*break*/, 1];
                    _a = cache[srcDir].glob;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, globP('**', { cwd: srcDir, ignore: ignore, dot: dot, nodir: nodir })];
                case 2:
                    _a = _g.sent();
                    _g.label = 3;
                case 3:
                    srcList = _a;
                    return [4 /*yield*/, globP('**', { cwd: destDir, ignore: ignore, dot: dot, nodir: nodir })];
                case 4:
                    destList = _g.sent();
                    srcMap = makeListMap(srcList);
                    destMap = makeListMap(destList);
                    newFiles = srcList.filter(function (file) { return !destMap[file]; });
                    filesToRemove = destList.filter(function (file) { return !srcMap[file]; });
                    commonFiles = srcList.filter(function (file) { return destMap[file]; });
                    cache[srcDir] = cache[srcDir] || {
                        files: {},
                        glob: srcList,
                    };
                    filesToReplace = [];
                    srcCached = cache[srcDir].files;
                    dirsInDest = {};
                    _g.label = 5;
                case 5:
                    _g.trys.push([5, 17, 18, 23]);
                    commonFiles_1 = __asyncValues(commonFiles);
                    _g.label = 6;
                case 6: return [4 /*yield*/, commonFiles_1.next()];
                case 7:
                    if (!(commonFiles_1_1 = _g.sent(), !commonFiles_1_1.done)) return [3 /*break*/, 16];
                    file = commonFiles_1_1.value;
                    srcCached[file] = srcCached[file] || {};
                    srcFilePath = path_1.resolve(srcDir, file);
                    destFilePath = path_1.resolve(destDir, file);
                    _b = srcCached[file].stat;
                    if (_b) return [3 /*break*/, 9];
                    return [4 /*yield*/, fs_extra_1.default.stat(srcFilePath)];
                case 8:
                    _b = (_g.sent());
                    _g.label = 9;
                case 9:
                    srcFileStat = _b;
                    srcCached[file].stat = srcFileStat;
                    return [4 /*yield*/, fs_extra_1.default.stat(destFilePath)];
                case 10:
                    destFileStat = _g.sent();
                    areDirs = srcFileStat.isDirectory() && destFileStat.isDirectory();
                    dirsInDest[file] = destFileStat.isDirectory();
                    replacedFileWithDir = srcFileStat.isDirectory() && !destFileStat.isDirectory();
                    dirReplacedWithFile = !srcFileStat.isDirectory() && destFileStat.isDirectory();
                    if (dirReplacedWithFile || replacedFileWithDir) {
                        filesToRemove.push(file);
                    }
                    compareByHash = function () { return __awaiter(void 0, void 0, void 0, function () {
                        var srcHash, _a, destHash;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _a = srcCached[file].hash;
                                    if (_a) return [3 /*break*/, 2];
                                    return [4 /*yield*/, copy_1.getFileHash(srcFilePath, '')];
                                case 1:
                                    _a = (_b.sent());
                                    _b.label = 2;
                                case 2:
                                    srcHash = _a;
                                    srcCached[file].hash = srcHash;
                                    return [4 /*yield*/, copy_1.getFileHash(destFilePath, '')];
                                case 3:
                                    destHash = _b.sent();
                                    return [2 /*return*/, srcHash === destHash];
                            }
                        });
                    }); };
                    _c = dirReplacedWithFile;
                    if (_c) return [3 /*break*/, 14];
                    _d = !areDirs &&
                        !theSameStats(srcFileStat, destFileStat);
                    if (!_d) return [3 /*break*/, 13];
                    _e = !compareContent;
                    if (_e) return [3 /*break*/, 12];
                    return [4 /*yield*/, compareByHash()];
                case 11:
                    _e = !(_g.sent());
                    _g.label = 12;
                case 12:
                    _d = (_e);
                    _g.label = 13;
                case 13:
                    _c = (_d);
                    _g.label = 14;
                case 14:
                    if (_c) {
                        filesToReplace.push(file);
                    }
                    _g.label = 15;
                case 15: return [3 /*break*/, 6];
                case 16: return [3 /*break*/, 23];
                case 17:
                    e_1_1 = _g.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 23];
                case 18:
                    _g.trys.push([18, , 21, 22]);
                    if (!(commonFiles_1_1 && !commonFiles_1_1.done && (_f = commonFiles_1.return))) return [3 /*break*/, 20];
                    return [4 /*yield*/, _f.call(commonFiles_1)];
                case 19:
                    _g.sent();
                    _g.label = 20;
                case 20: return [3 /*break*/, 22];
                case 21:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 22: return [7 /*endfinally*/];
                case 23: 
                // console.log('newFiles', newFiles)
                // console.log('filesToRemove', filesToRemove)
                // console.log('filesToReplace', filesToReplace)
                // first remove files
                return [4 /*yield*/, Promise.all(filesToRemove
                        .filter(function (file) { return !dirsInDest[file]; })
                        .map(function (file) { return fs_extra_1.default.remove(path_1.resolve(destDir, file)); }))
                    // then empty directories
                ];
                case 24:
                    // console.log('newFiles', newFiles)
                    // console.log('filesToRemove', filesToRemove)
                    // console.log('filesToReplace', filesToReplace)
                    // first remove files
                    _g.sent();
                    // then empty directories
                    return [4 /*yield*/, Promise.all(filesToRemove
                            .filter(function (file) { return dirsInDest[file]; })
                            .map(function (file) { return fs_extra_1.default.remove(path_1.resolve(destDir, file)); }))];
                case 25:
                    // then empty directories
                    _g.sent();
                    return [4 /*yield*/, Promise.all(newFiles.map(function (file) {
                            return fs_extra_1.default.stat(path_1.resolve(srcDir, file)).then(function (stat) { return stat.isDirectory(); });
                        }))];
                case 26:
                    newFilesDirs = _g.sent();
                    return [4 /*yield*/, Promise.all(newFiles
                            .filter(function (file, index) { return !newFilesDirs[index]; })
                            .concat(filesToReplace)
                            .map(function (file) { return fs_extra_1.default.copy(path_1.resolve(srcDir, file), path_1.resolve(destDir, file)); }))];
                case 27:
                    _g.sent();
                    return [2 /*return*/];
            }
        });
    });
};
//# sourceMappingURL=sync-dir.js.map