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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writePackageManifest = exports.readPackageManifest = exports.parsePackageName = void 0;
var fs = __importStar(require("fs-extra"));
var path_1 = require("path");
var detect_indent_1 = __importDefault(require("detect-indent"));
exports.parsePackageName = function (packageName) {
    var match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || [];
    if (!match) {
        return { name: '', version: '' };
    }
    return {
        name: ((match[1] || '') + match[2]),
        version: match[3] || '',
    };
};
var getIndent = function (jsonStr) {
    return detect_indent_1.default(jsonStr).indent;
};
function readPackageManifest(workingDir) {
    var pkg;
    var packagePath = path_1.join(workingDir, 'package.json');
    try {
        var fileData = fs.readFileSync(packagePath, 'utf-8');
        pkg = JSON.parse(fileData);
        if (!pkg.name && pkg.version) {
            console.log('Package manifest', packagePath, 'should contain name and version.');
            return null;
        }
        var indent = getIndent(fileData) || '  ';
        pkg.__Indent = indent;
        return pkg;
    }
    catch (e) {
        console.error('Could not read', packagePath);
        return null;
    }
}
exports.readPackageManifest = readPackageManifest;
var sortDependencies = function (dependencies) {
    return Object.keys(dependencies)
        .sort()
        .reduce(function (deps, key) {
        var _a;
        return Object.assign(deps, (_a = {}, _a[key] = dependencies[key], _a));
    }, {});
};
function writePackageManifest(workingDir, pkg) {
    pkg = Object.assign({}, pkg);
    if (pkg.dependencies) {
        pkg.dependencies = sortDependencies(pkg.dependencies);
    }
    if (pkg.devDependencies) {
        pkg.devDependencies = sortDependencies(pkg.devDependencies);
    }
    var indent = pkg.__Indent;
    delete pkg.__Indent;
    var packagePath = path_1.join(workingDir, 'package.json');
    try {
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, indent) + '\n');
    }
    catch (e) {
        console.error('Could not write ', packagePath);
    }
}
exports.writePackageManifest = writePackageManifest;
//# sourceMappingURL=pkg.js.map