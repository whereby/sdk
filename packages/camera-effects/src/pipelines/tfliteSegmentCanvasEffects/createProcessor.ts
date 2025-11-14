// @ts-nocheck
import Processor from "./Processor";
import ProcessorProxy from "./ProcessorProxy";

let sharedWorker;

// creates a processor on main thread or background thread
export default function createProcessor(useBackgroundWorker, config) {
    if (!useBackgroundWorker) return new Processor(config);

    if (!sharedWorker) {
        const workerUrl = new URL("./workers/ProcessorProxy.worker.js", import.meta.url);
        sharedWorker = new Worker(workerUrl);
    }
    return new ProcessorProxy(sharedWorker, config);
}
