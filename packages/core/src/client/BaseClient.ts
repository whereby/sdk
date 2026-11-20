import { EventEmitter } from "events";
import type { RootState } from "../redux";
import type { Store as AppStore } from "../redux/store";

type Emit<TEvents extends Record<string, unknown[]>> = <TEvent extends keyof TEvents & string>(
    event: TEvent,
    ...args: TEvents[TEvent]
) => void;

/**
 * Describes one key of a client's state.
 */
export interface StateKeyDefinition<TEvents extends Record<string, unknown[]>, TValue> {
    /**
     * Selects the value. It must return the same value until something it depends on changes, as any
     * other value notifies the key's subscribers, so a value built from several others needs a
     * memoized selector.
     */
    selector: (state: RootState) => TValue;
    /**
     * Emits the key's events when its value changes, or null for a key without events.
     */
    emit: ((emit: Emit<TEvents>, value: TValue, previousValue: TValue) => void) | null;
}

/**
 * Describes every key of a client's state. The client gets its state, notifies subscribers and emits
 * events from this, one key at a time.
 */
export type StateDefinition<TState, TEvents extends Record<string, unknown[]>> = {
    [TKey in keyof TState]-?: StateKeyDefinition<TEvents, TState[TKey]>;
};

export abstract class BaseClient<TState, TEvents extends Record<string, unknown[]>> extends EventEmitter<TEvents> {
    protected store: AppStore;
    protected previousState: TState;
    private currentState?: TState;
    private stateDefinition: StateDefinition<TState, TEvents>;
    private stateKeys: (keyof TState)[];
    private stateSubscribers = new Set<(state: TState) => void>();
    private stateKeySubscribers = new Map<keyof TState, Set<(value: never) => void>>();

    constructor(store: AppStore, stateDefinition: StateDefinition<TState, TEvents>) {
        super();
        this.store = store;
        this.stateDefinition = stateDefinition;
        this.stateKeys = Object.keys(stateDefinition) as (keyof TState)[];
        this.previousState = this.getState();
        this.setupEventBridge();
    }

    /**
     * Gets the current state of the client.
     * @returns The current state of the client. It's the same object until a value in it changes.
     */
    public getState(): TState {
        const rootState = this.store.getState();
        const values = this.stateKeys.map((key) => this.stateDefinition[key].selector(rootState));

        const currentState = this.currentState;
        if (currentState && this.stateKeys.every((key, i) => currentState[key] === values[i])) {
            return currentState;
        }

        this.currentState = Object.fromEntries(this.stateKeys.map((key, i) => [key, values[i]])) as TState;
        return this.currentState;
    }

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
     * Subscribes to changes of one key of the state.
     * @param key The key of the state.
     * @param callback The callback function to be called with the key's value when it changes.
     * @returns A function to unsubscribe from the changes.
     */
    protected subscribeToStateKey<TKey extends keyof TState>(
        key: TKey,
        callback: (value: TState[TKey]) => void,
    ): () => void {
        let subscribers = this.stateKeySubscribers.get(key);

        if (!subscribers) {
            subscribers = new Set();
            this.stateKeySubscribers.set(key, subscribers);
        }
        subscribers.add(callback);

        return () => subscribers.delete(callback);
    }

    /**
     * Notifies the subscribers of each key that changed and emits its events, in the order of the
     * state definition. A subclass that overrides this must call it, or nothing is notified.
     * @param state The current state of the client.
     * @param previousState The previous state of the client.
     */
    protected handleStateChanges(state: TState, previousState: TState): void {
        const emit: Emit<TEvents> = (event, ...args) => {
            // EventEmitter's types can't relate a generic event name to its arguments
            (this.emit as (event: string, ...args: unknown[]) => boolean)(event, ...args);
        };

        this.stateKeys.forEach((key) => {
            const value = state[key];
            const previousValue = previousState[key];

            if (value === previousValue) {
                return;
            }

            this.stateKeySubscribers
                .get(key)
                ?.forEach((callback) => (callback as (value: TState[typeof key]) => void)(value));
            this.stateDefinition[key].emit?.(emit, value, previousValue);
        });
    }

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
            this.stateSubscribers.forEach((callback) => callback(currentState));
            this.previousState = currentState;
        });
    }

    /**
     * Stops what the client started, when it's destroyed. The subscribers of each key are still
     * notified of the changes this makes.
     */
    protected onDestroy(): void {}

    /**
     * Destroys the client by clearing all subscribers and removing all listeners.
     * @returns void
     * @public
     */
    public destroy() {
        this.stateSubscribers.clear();
        this.removeAllListeners();
        this.onDestroy();
        this.stateKeySubscribers.clear();
    }
}
