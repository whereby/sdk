// @ts-nocheck
import Processor from "./Processor";
import ProcessorProxy from "./ProcessorProxy";
import ProcessorProxyWorker from "web-worker:./ProcessorProxy.worker";

let sharedWorker = null;
let activeProxyCount = 0;

// creates a processor on main thread or background thread
export default function createProcessor(useBackgroundWorker, config) {
    if (!useBackgroundWorker) return new Processor(config);

    if (!sharedWorker) {
        sharedWorker = new ProcessorProxyWorker();
        activeProxyCount = 0;
    }
    activeProxyCount++;
    const proxy = new ProcessorProxy(sharedWorker, config);
    proxy.once("terminated", () => {
        activeProxyCount--;
        if (activeProxyCount <= 0) {
            sharedWorker?.terminate();
            sharedWorker = null;
            activeProxyCount = 0;
        }
    });
    return proxy;
}
