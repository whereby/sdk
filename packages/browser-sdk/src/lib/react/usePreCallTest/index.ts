import * as React from "react";
import { PreCallTestOptions, PreCallTestState } from "@whereby.com/core";
import { UsePreCallTestResult } from "./types";
import { WherebyContext } from "../Provider";
import { initialState } from "./initialState";

/**
 * Measures the connection between this client and the Whereby media servers, so
 * you can warn people about a bad network before they join a room.
 *
 * The test is never started for you - call `actions.startTest()`. It needs no
 * room and no local media, but it does compete for bandwidth with any call
 * already in progress, so run it before joining.
 */
export function usePreCallTest(): UsePreCallTestResult {
    const client = React.useContext(WherebyContext)?.getPreCallTest();
    const [preCallTestState, setPreCallTestState] = React.useState<PreCallTestState>(() => initialState);

    if (!client) {
        throw new Error("WherebyClient is not initialized. Please wrap your component with WherebyProvider.");
    }

    const isRunning = preCallTestState.status === "running";
    const isRunningRef = React.useRef(isRunning);
    isRunningRef.current = isRunning;

    React.useEffect(() => {
        // A test may already be running - started elsewhere, or before this
        // component mounted.
        setPreCallTestState(client.getState());

        const unsubscribe = client.subscribe(setPreCallTestState);

        return () => {
            unsubscribe();

            // Leave a finished test's result in place for anyone else reading it;
            // only tear down a test that is still consuming bandwidth.
            if (isRunningRef.current) {
                client.stopTest();
            }
        };
    }, [client]);

    const startTest = React.useCallback((options?: PreCallTestOptions) => client.startTest(options), [client]);
    const stopTest = React.useCallback(() => client.stopTest(), [client]);

    return {
        state: preCallTestState,
        actions: {
            startTest,
            stopTest,
        },
    };
}
