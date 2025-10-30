// eslint-disable-next-line import/no-unresolved
import Worker from "worker-loader?filename=assets/js/processorproxy.[hash:8].worker.js!./ProcessorProxy.worker.js";

import Processor from "./Processor";
import ProcessorProxy from "./ProcessorProxy";

let sharedWorker;

// hack to make worker-loader work with haproxy setup (relative publicPath doesn't work)
// should upgrade to webpack 5 which has builtin support for workers
const webpackWorkerImportHack = (code) => {
    // eslint-disable-next-line
    const original = __webpack_public_path__;
    // eslint-disable-next-line
    __webpack_public_path__ = window.location.pathname.replace(/[^\/]+\/?$/, "");
    code();
    // eslint-disable-next-line
    __webpack_public_path__ = original;
};

// creates a processor on main thread or background thread
export default function createProcessor(useBackgroundWorker, config) {
    if (!useBackgroundWorker) return new Processor(config);

    if (!sharedWorker) {
        webpackWorkerImportHack(() => {
            sharedWorker = new Worker();
        });
    }
    return new ProcessorProxy(sharedWorker, config);
}
