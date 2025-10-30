// @ts-nocheck
import Worker from "./ProcessorProxy.worker.js";

import Processor from "./Processor";
import ProcessorProxy from "./ProcessorProxy";

let sharedWorker;

// creates a processor on main thread or background thread
export default function createProcessor(useBackgroundWorker, config) {
    if (!useBackgroundWorker) return new Processor(config);

    if (!sharedWorker) {
        sharedWorker = new Worker();
    }
    return new ProcessorProxy(sharedWorker, config);
}
