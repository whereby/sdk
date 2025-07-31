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

    /**
     * Gets the current state of the client.
     * @returns The current state of the client.
     */
    public abstract getState(): TState;

    /**
     * Subscribes to state changes.
     * @param callback The callback function to be called when the state changes.
     * @returns A function to unsubscribe from the state changes.
     */
    public subscribe(callback: (state: TState) => void): () => void {
        this.stateSubscribers.add(callback);

        return () => this.stateSubscribers.delete(callback);
    }

    /**
     * Handles state changes by comparing the current state with the previous state.
     * @param state The current state of the client.
     * @param previousState The previous state of the client.
     * @returns void
     * @protected
     */
    protected abstract handleStateChanges(state: TState, previousState: TState): void;

    /**
     * Sets up the event bridge to listen for state changes and emit events accordingly.
     * @returns void
     * @private
     */
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

    /**
     * Destroys the client by clearing all subscribers and removing all listeners.
     * @returns void
     * @public
     */
    public destroy() {
        this.stateSubscribers.clear();
        this.removeAllListeners();
    }
}
