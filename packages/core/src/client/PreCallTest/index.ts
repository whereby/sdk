import { doStartPreCallTest, doStopPreCallTest, type PreCallTestResult } from "../../redux";
import type { Store as AppStore } from "../../redux/store";
import { BaseClient } from "../BaseClient";
import { PrecallTestOptions } from "../RoomConnection/types";
import {
    PRE_CALL_TEST_ERROR_CHANGED,
    PRE_CALL_TEST_RESULT_CHANGED,
    PRE_CALL_TEST_STATUS_CHANGED,
    type PreCallTestEvents,
} from "./events";
import { selectPreCallTestState } from "./selector";
import type { PreCallTestError, PreCallTestState, PreCallTestStatus } from "./types";

/**
 * Measures the connection between this client and the Whereby media servers,
 * so you can warn people about a bad network before they join a room.
 *
 * The test runs on its own connection - it needs no room and no local media -
 * but it does need a browser environment, and it competes for bandwidth with
 * any call already in progress.
 */
export class PreCallTestClient extends BaseClient<PreCallTestState, PreCallTestEvents> {
    protected options: Partial<PrecallTestOptions>;

    private statusSubscribers = new Set<(status: PreCallTestStatus) => void>();
    private resultSubscribers = new Set<(result: PreCallTestResult | null) => void>();
    private errorSubscribers = new Set<(error: PreCallTestError | null) => void>();

    constructor(store: AppStore) {
        super(store);
        this.options = {};
    }

    protected handleStateChanges(state: PreCallTestState, previousState: PreCallTestState): void {
        if (state.status !== previousState.status) {
            this.statusSubscribers.forEach((cb) => cb(state.status));
            this.emit(PRE_CALL_TEST_STATUS_CHANGED, state.status);
        }

        if (state.result !== previousState.result) {
            this.resultSubscribers.forEach((cb) => cb(state.result));
            this.emit(PRE_CALL_TEST_RESULT_CHANGED, state.result);
        }

        if (state.error !== previousState.error) {
            this.errorSubscribers.forEach((cb) => cb(state.error));
            this.emit(PRE_CALL_TEST_ERROR_CHANGED, state.error);
        }
    }

    public getState(): PreCallTestState {
        return selectPreCallTestState(this.store.getState());
    }

    /* Subscriptions */

    public subscribeStatus(callback: (status: PreCallTestStatus) => void): () => void {
        this.statusSubscribers.add(callback);

        return () => this.statusSubscribers.delete(callback);
    }

    public subscribeResult(callback: (result: PreCallTestResult | null) => void): () => void {
        this.resultSubscribers.add(callback);

        return () => this.resultSubscribers.delete(callback);
    }

    public subscribeError(callback: (error: PreCallTestError | null) => void): () => void {
        this.errorSubscribers.add(callback);

        return () => this.errorSubscribers.delete(callback);
    }

    /* Actions */

    /**
     * Initialize the precall test with options.
     * This method can be called multiple times to update options.
     * @param options<PrecallTestOptions> - Options for the Precall Test.
     */
    public initialize(options: PrecallTestOptions) {
        this.options = options;
    }

    /**
     * Runs a test and resolves with its result, or with `null` if the test could
     * not complete - read `getState().error` for why. Calling this while a test
     * is already running resolves with `null` and leaves that test alone.
     */
    public async startTest(): Promise<PreCallTestResult | null> {
        const { roomUrl } = this.options;

        if (!roomUrl) {
            throw new Error("Room URL is required to run a bandwidth test.");
        }

        return await this.store.dispatch(doStartPreCallTest({ roomUrl })).unwrap();
    }

    /** Aborts a running test and returns to the idle state. */
    public stopTest() {
        return this.store.dispatch(doStopPreCallTest());
    }

    /**
     * Destroy the PreCallTestClient instance.
     * This method cleans up any resources and event listeners.
     */
    public destroy() {
        super.destroy();
        this.stopTest();
        this.removeAllListeners();
        this.statusSubscribers.clear();
        this.resultSubscribers.clear();
        this.errorSubscribers.clear();
    }
}
