// @ts-nocheck
// This runs on worker thread and makes ProcessorProxies on main thread
// communicate with Processors on worker thread

import Processor from "./Processor";

const processors = {};

onmessage = function (request) {
    const processorId = request.data.processorId;

    if (request.data.type === "create") {
        const processor = new Processor({
            ...request.data,
            emit: (type, data, transfer) => postMessage({ processorId, type, ...data }, transfer),
        });
        processors[processorId] = processor;
    } else {
        processors[processorId]?.[request.data.type](request.data);
        if (request.data.type === "terminate") {
            delete processors[processorId];
        }
    }
};
