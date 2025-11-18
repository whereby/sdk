// @ts-nocheck
import Processor from "./Processor";
import ProcessorProxy from "./ProcessorProxy";
import ProcessorProxyWorker from "web-worker:./ProcessorProxy.worker";

let sharedWorker;

// creates a processor on main thread or background thread
export default function createProcessor(useBackgroundWorker, config) {
    if (!useBackgroundWorker) return new Processor(config);

    if (!sharedWorker) {
        sharedWorker = new ProcessorProxyWorker();
    }
    return new ProcessorProxy(sharedWorker, config);
}
