export interface Check extends EventTarget {
    run: () => void;
}

export type CheckStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface UseCheckRef {
    id: string;
    description: string;
    state: {
        status: CheckStatus;
        output: string[];
    };
    actions: {
        start: () => void;
        skip: () => void;
    };
}
