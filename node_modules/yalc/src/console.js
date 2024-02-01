"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeConsoleColored = exports.disabledConsoleOutput = void 0;
var chalk_1 = __importDefault(require("chalk"));
var overloadConsole = function (_a) {
    var output = _a.output, methods = _a.methods;
    var oldMethods = {};
    methods.forEach(function (m) {
        var method = m;
        if (typeof console[method] !== 'function')
            return;
        oldMethods[method] = console[method];
        console[method] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            output({ method: method, args: args, oldMethods: oldMethods });
        };
    });
};
exports.disabledConsoleOutput = function () {
    overloadConsole({
        methods: ['log', 'warn', 'info'],
        output: function () { },
    });
};
exports.makeConsoleColored = function () {
    overloadConsole({
        methods: ['log', 'warn', 'error', 'info'],
        output: function (_a) {
            var method = _a.method, args = _a.args, oldMethods = _a.oldMethods;
            var fns = {
                warn: chalk_1.default.yellowBright,
                info: chalk_1.default.blueBright,
                error: chalk_1.default.redBright,
            };
            var fn = fns[method] || (function (arg) { return arg; });
            oldMethods[method].apply(oldMethods, args.map(function (arg) { return (typeof arg === 'string' ? fn(arg) : arg); }));
        },
    });
};
//# sourceMappingURL=console.js.map