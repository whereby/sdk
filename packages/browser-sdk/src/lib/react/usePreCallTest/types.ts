export type PreCallTestStatus = "idle" | "running" | "completed" | "failed" | "skipped";

export interface UseTestRef {
    description: string;
    state: {
        status: PreCallTestStatus;
        output: string;
    };
    actions: {
        start: () => void;
        skip: () => void;
    };
}

export interface Test extends EventTarget {
    run: () => void;
}
