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
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishPackage = void 0;
var child_process_1 = require("child_process");
var path_1 = require("path");
var _1 = require(".");
var copy_1 = require("./copy");
var installations_1 = require("./installations");
var pm_1 = require("./pm");
exports.publishPackage = function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var workingDir, pkg, pm, runPmScript, preScripts, copyRes, postScripts, publishedPackageDir, publishedPkg, installationsConfig, installationPaths, installationsToRemove, _i, installationPaths_1, workingDir_1, installationsToRemoveForPkg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                workingDir = options.workingDir;
                pkg = _1.readPackageManifest(workingDir);
                if (!pkg) {
                    return [2 /*return*/];
                }
                pm = _1.getPackageManager(workingDir);
                runPmScript = function (script) {
                    var _a;
                    if (!options.scripts)
                        return;
                    var scriptCmd = (_a = pkg.scripts) === null || _a === void 0 ? void 0 : _a[script];
                    if (scriptCmd) {
                        console.log("Running " + script + " script: " + scriptCmd);
                        child_process_1.execSync(pm_1.pmRunScriptCmd[pm] + " " + script, __assign({ cwd: workingDir }, _1.execLoudOptions));
                    }
                };
                if (pkg.private && !options.private) {
                    console.log('Will not publish package with `private: true`' +
                        ' use --private flag to force publishing.');
                    return [2 /*return*/];
                }
                preScripts = [
                    'prepublish',
                    'prepare',
                    'prepublishOnly',
                    'prepack',
                    'preyalcpublish',
                ];
                preScripts.forEach(runPmScript);
                return [4 /*yield*/, copy_1.copyPackageToStore(options)];
            case 1:
                copyRes = _a.sent();
                if (options.changed && !copyRes) {
                    console.warn('Package content has not changed, skipping publishing.');
                    return [2 /*return*/];
                }
                postScripts = [
                    'postyalcpublish',
                    'postpack',
                    'publish',
                    'postpublish',
                ];
                postScripts.forEach(runPmScript);
                publishedPackageDir = path_1.join(_1.getStorePackagesDir(), pkg.name, pkg.version);
                publishedPkg = _1.readPackageManifest(publishedPackageDir);
                console.log(publishedPkg.name + "@" + publishedPkg.version + " published in store.");
                if (!options.push) return [3 /*break*/, 7];
                installationsConfig = installations_1.readInstallationsFile();
                installationPaths = installationsConfig[pkg.name] || [];
                installationsToRemove = [];
                _i = 0, installationPaths_1 = installationPaths;
                _a.label = 2;
            case 2:
                if (!(_i < installationPaths_1.length)) return [3 /*break*/, 5];
                workingDir_1 = installationPaths_1[_i];
                console.info("Pushing " + pkg.name + "@" + pkg.version + " in " + workingDir_1);
                return [4 /*yield*/, _1.updatePackages([pkg.name], {
                        replace: options.replace,
                        workingDir: workingDir_1,
                        update: options.update,
                        noInstallationsRemove: true,
                    })];
            case 3:
                installationsToRemoveForPkg = _a.sent();
                installationsToRemove.push.apply(installationsToRemove, installationsToRemoveForPkg);
                _a.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [4 /*yield*/, installations_1.removeInstallations(installationsToRemove)];
            case 6:
                _a.sent();
                _a.label = 7;
            case 7: return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=publish.js.map