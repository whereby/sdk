import createProcessor from "../createProcessor";
import Processor from "../Processor";
import ProcessorProxy from "../ProcessorProxy";

interface MockWorkerInstance {
    postMessage: jest.Mock;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    terminate: jest.Mock;
}

const mockWorkerInstances: MockWorkerInstance[] = [];

jest.mock(
    "web-worker:./ProcessorProxy.worker",
    () => {
        return jest.fn().mockImplementation(() => {
            const listeners: Record<string, ((event: { data: { type: string; processorId: number } }) => void)[]> = {};
            const instance: MockWorkerInstance = {
                postMessage: jest.fn((msg) => {
                    if (msg.type === "terminate") {
                        // Simulate worker replying with terminated event
                        const handler = listeners["message"];
                        if (handler) {
                            handler.forEach((fn) =>
                                fn({ data: { type: "terminated", processorId: msg.processorId } }),
                            );
                        }
                    }
                }),
                addEventListener: jest.fn((event, fn) => {
                    listeners[event] = listeners[event] || [];
                    listeners[event].push(fn);
                }),
                removeEventListener: jest.fn((event, fn) => {
                    if (listeners[event]) {
                        listeners[event] = listeners[event].filter((cb) => cb !== fn);
                    }
                }),
                terminate: jest.fn(),
            };
            mockWorkerInstances.push(instance);
            return instance;
        });
    },
    { virtual: true },
);

jest.mock("../Processor", () => {
    return jest.fn().mockImplementation(function (this: { config: unknown; terminate: jest.Mock; emit: jest.Mock }, config: unknown) {
        this.config = config;
        this.terminate = jest.fn();
        this.emit = jest.fn();
    });
});

interface ProcessorProxyInstance extends ProcessorProxy {
    terminate(args?: unknown): void;
}

describe("createProcessor", () => {
    beforeEach(() => {
        mockWorkerInstances.length = 0;
        jest.clearAllMocks();
    });

    it("creates a direct Processor on the main thread when useBackgroundWorker is false", () => {
        const processor = createProcessor(false, { setup: {}, params: {} });
        expect(processor).toBeInstanceOf(Processor);
        expect(mockWorkerInstances.length).toBe(0);
    });

    it("creates and reuses sharedWorker for multiple ProcessorProxy instances, and terminates worker when all are terminated", () => {
        const proxy1 = createProcessor(true, { setup: { id: 1 }, params: {} }) as ProcessorProxyInstance;
        expect(proxy1).toBeInstanceOf(ProcessorProxy);
        expect(mockWorkerInstances.length).toBe(1);
        const worker1 = mockWorkerInstances[0];

        const proxy2 = createProcessor(true, { setup: { id: 2 }, params: {} }) as ProcessorProxyInstance;
        expect(proxy2).toBeInstanceOf(ProcessorProxy);
        // Should reuse existing worker, not spawn a new one
        expect(mockWorkerInstances.length).toBe(1);

        // Terminate first proxy
        proxy1.terminate({});
        expect(worker1.terminate).not.toHaveBeenCalled();

        // Terminate second proxy
        proxy2.terminate({});
        expect(worker1.terminate).toHaveBeenCalledTimes(1);

        // Creating a new processor afterwards should create a fresh worker
        const proxy3 = createProcessor(true, { setup: { id: 3 }, params: {} }) as ProcessorProxyInstance;
        expect(proxy3).toBeInstanceOf(ProcessorProxy);
        expect(mockWorkerInstances.length).toBe(2);
    });
});
