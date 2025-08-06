import { OriginTrial, registerOriginTrials } from "../../../utils/originTrial";
import { PressureRecord } from "../types";

interface CpuObserverOptions {
    /** Sample rate, in seconds */
    sampleRate: number;
    originTrials: OriginTrial[];
}

export interface PressureObserver {
    observe: (source: string, options: { sampleInterval: number }) => Promise<undefined>;
    unobserve: (source: string) => undefined;
}

const CPU_OBSERVER_OPTIONS: CpuObserverOptions = {
    sampleRate: 1,
    // these tokens expire May 29th 2024
    originTrials: [
        {
            hostnamePattern: /hereby\.dev/,
            token: "AkSNPHJw6EK08X0QU7kORnK9NABzRLAC7dqfXOwk5JwFAQG4Ey7WxLXxsnhieCgC1QHUdevE2EFICy7uBGDANwUAAABqeyJvcmlnaW4iOiJodHRwczovL2hlcmVieS5kZXY6NDQ0MyIsImZlYXR1cmUiOiJDb21wdXRlUHJlc3N1cmVfdjIiLCJleHBpcnkiOjE3MTY5NDA3OTksImlzU3ViZG9tYWluIjp0cnVlfQ==",
        },
        {
            hostnamePattern: /whereby\.com/,
            token: "Asc2wu8KpSx648i932NICteQDFcB05yl2QUUSHD7AQo8JGP2Fp6FF91TvYVJBsKGzLMH349rysPw5q9tqPC/PAUAAABqeyJvcmlnaW4iOiJodHRwczovL3doZXJlYnkuY29tOjQ0MyIsImZlYXR1cmUiOiJDb21wdXRlUHJlc3N1cmVfdjIiLCJleHBpcnkiOjE3MTY5NDA3OTksImlzU3ViZG9tYWluIjp0cnVlfQ==",
        },
    ],
};

export function startCpuObserver(
    cb: (records: PressureRecord[]) => void,
    { sampleRate, originTrials }: CpuObserverOptions = CPU_OBSERVER_OPTIONS,
    window: Window = globalThis.window,
) {
    registerOriginTrials(originTrials);

    let pressureObserver: PressureObserver;

    if ("PressureObserver" in window) {
        pressureObserver = new (window.PressureObserver as any)(cb, { sampleRate }) as PressureObserver;
        pressureObserver.observe("cpu", { sampleInterval: sampleRate * 1000 });

        return {
            stop: () => {
                pressureObserver.unobserve("cpu");
            },
        };
    }
}
