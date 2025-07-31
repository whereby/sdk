import { EventEmitter } from "events";
import type { Store as AppStore } from "../redux/store";

export abstract class BaseClient<TState, TEvents extends Record<string, unknown[]>> extends EventEmitter<TEvents> {
    protected store: AppStore;
    protected previousState: TState;
    private stateSubscribers = new Set<(state: TState) => void>();

    constructor(store: AppStore) {
        super();
        this.store = store;
        this.previousState = this.getState();
        this.setupEventBridge();
    }

    public abstract getState(): TState;

    public subscribe(callback: (state: TState) => void): () => void {
        this.stateSubscribers.add(callback);

        return () => this.stateSubscribers.delete(callback);
    }

    protected abstract handleStateChanges(state: TState, previousState: TState): void;

    private setupEventBridge() {
        this.store.subscribe(() => {
            const currentState = this.getState();

            if (currentState === this.previousState) {
                return;
            }

            this.handleStateChanges(currentState, this.previousState);
            this.previousState = currentState;
        });
    }

    public destroy() {
        this.stateSubscribers.clear();
        this.removeAllListeners();
    }
}
