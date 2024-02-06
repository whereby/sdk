const debugOn = process.env.NODE_ENV === "development" || new URLSearchParams(window.location.search).has("debug");

class Logger {
    constructor() {
        this._isEnabled = debugOn;
    }

    isEnabled() {
        return this._isEnabled;
    }

    enable() {
        this._isEnabled = true;
    }

    disable() {
        this._isEnabled = false;
    }

    info(...params) {
        if (!this._isEnabled) {
            return;
        }
        // eslint-disable-next-line no-console
        return console.info(...params);
    }

    warn(...params) {
        if (!this._isEnabled) {
            return;
        }
        return console.warn(...params);
    }

    error(...params) {
        if (!this._isEnabled) {
            return;
        }
        return console.error(...params);
    }

    withDebugLogger(myDebugger = null) {
        this._debugger = myDebugger;
        return this;
    }

    debug(...params) {
        if (!this._isEnabled || !this._debugger) {
            return;
        }
        const suppliedParams = [];
        params.forEach((param) => {
            if (typeof param === "function") {
                const suppliedParam = param();
                suppliedParams.push(suppliedParam);
            } else {
                suppliedParams.push(param);
            }
        });
        this._debugger.print(...suppliedParams);
    }
}

export default Logger;
