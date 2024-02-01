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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeSignatureFile = exports.readIgnoreFile = exports.readSignatureFile = exports.execLoudOptions = exports.getPackageStoreDir = exports.getStorePackagesDir = exports.getStoreMainDir = exports.yalcGlobal = exports.values = void 0;
var fs = __importStar(require("fs-extra"));
var os_1 = require("os");
var path_1 = require("path");
var userHome = os_1.homedir();
exports.values = {
    myNameIs: 'yalc',
    ignoreFileName: '.yalcignore',
    myNameIsCapitalized: 'Yalc',
    lockfileName: 'yalc.lock',
    yalcPackagesFolder: '.yalc',
    prescript: 'preyalc',
    postscript: 'postyalc',
    installationsFile: 'installations.json',
};
var publish_1 = require("./publish");
Object.defineProperty(exports, "publishPackage", { enumerable: true, get: function () { return publish_1.publishPackage; } });
var update_1 = require("./update");
Object.defineProperty(exports, "updatePackages", { enumerable: true, get: function () { return update_1.updatePackages; } });
var check_1 = require("./check");
Object.defineProperty(exports, "checkManifest", { enumerable: true, get: function () { return check_1.checkManifest; } });
var remove_1 = require("./remove");
Object.defineProperty(exports, "removePackages", { enumerable: true, get: function () { return remove_1.removePackages; } });
var add_1 = require("./add");
Object.defineProperty(exports, "addPackages", { enumerable: true, get: function () { return add_1.addPackages; } });
__exportStar(require("./pkg"), exports);
__exportStar(require("./pm"), exports);
/*
  Not using Node.Global because in this case
  <reference types="mocha" /> is aded in built d.ts file
*/
exports.yalcGlobal = global;
function getStoreMainDir() {
    if (exports.yalcGlobal.yalcStoreMainDir) {
        return exports.yalcGlobal.yalcStoreMainDir;
    }
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
        return path_1.join(process.env.LOCALAPPDATA, exports.values.myNameIsCapitalized);
    }
    return path_1.join(userHome, '.' + exports.values.myNameIs);
}
exports.getStoreMainDir = getStoreMainDir;
function getStorePackagesDir() {
    return path_1.join(getStoreMainDir(), 'packages');
}
exports.getStorePackagesDir = getStorePackagesDir;
exports.getPackageStoreDir = function (packageName, version) {
    if (version === void 0) { version = ''; }
    return path_1.join(getStorePackagesDir(), packageName, version);
};
exports.execLoudOptions = { stdio: 'inherit' };
var signatureFileName = 'yalc.sig';
exports.readSignatureFile = function (workingDir) {
    var signatureFilePath = path_1.join(workingDir, signatureFileName);
    try {
        var fileData = fs.readFileSync(signatureFilePath, 'utf-8');
        return fileData;
    }
    catch (e) {
        return '';
    }
};
exports.readIgnoreFile = function (workingDir) {
    var filePath = path_1.join(workingDir, exports.values.ignoreFileName);
    try {
        var fileData = fs.readFileSync(filePath, 'utf-8');
        return fileData;
    }
    catch (e) {
        return '';
    }
};
exports.writeSignatureFile = function (workingDir, signature) {
    var signatureFilePath = path_1.join(workingDir, signatureFileName);
    try {
        fs.writeFileSync(signatureFilePath, signature);
    }
    catch (e) {
        console.error('Could not write signature file');
        throw e;
    }
};
//# sourceMappingURL=index.js.map