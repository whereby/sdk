// @ts-nocheck
import { EventEmitter } from "events";

let nextProcessorId = 0;

// Proxy for running a Processor in a background thread
export default class ProcessorProxy extends EventEmitter {
    constructor(worker, config) {
        super();
        const processorId = nextProcessorId++;

        const proxyMethod = (name, getTransferable) => {
            this[name] = (args) => {
                worker.postMessage(
                    { type: name, processorId, ...args },
                    // transferable objects needs to be listed in the second argument to postMessage
                    getTransferable && getTransferable(args).filter((e) => e),
                );
            };
        };

        proxyMethod("init", (args) => [args.initialBackgroundFrame]);
        proxyMethod("start", (args) => [args.inputStream, args.outputStream]);
        proxyMethod("input", (args) => [args.videoFrame, args.backgroundFrame]);
        proxyMethod("updateBackgroundFrame", (args) => [args.frame]);
        proxyMethod("updateParams", (args) => [args.initialBackgroundFrame]);
        proxyMethod("updateVideoSize");
        proxyMethod("terminate");

        const onMessage = async (request) => {
            if (request.data.processorId !== processorId) return;
            const { type, ...data } = request.data;
            this.emit(type, data);
            if (type === "terminated") {
                worker.removeEventListener("message", onMessage);
            }
        };

        worker.postMessage({ type: "create", processorId, ...config });

        worker.addEventListener("message", onMessage);
    }
}
