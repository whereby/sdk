import { Logger } from "../../../utils";
import { PressureRecord } from "../types";

const logger = new Logger();

interface CpuObserverOptions {
    /** Sample rate, in seconds */
    sampleRate: number;
}

export interface PressureObserver {
    knownSources: string[];
    observe: (source: string, options: { sampleInterval: number }) => Promise<undefined>;
    unobserve: (source: string) => undefined;
}

const CPU_OBSERVER_OPTIONS: CpuObserverOptions = {
    sampleRate: 1,
};

export function startCpuObserver(
    cb: (records: PressureRecord[]) => void,
    { sampleRate }: CpuObserverOptions = CPU_OBSERVER_OPTIONS,
    window: Window = globalThis.window,
) {
    let pressureObserver: PressureObserver;

    if (
        "PressureObserver" in window &&
        ((window.PressureObserver as PressureObserver).knownSources || []).includes("cpu")
    ) {
        pressureObserver = new (window.PressureObserver as any)(cb, { sampleRate }) as PressureObserver;
        pressureObserver.observe("cpu", { sampleInterval: sampleRate * 1000 })?.catch((error) => logger.error(error));

        return {
            stop: () => {
                pressureObserver.unobserve("cpu");
            },
        };
    }
}
