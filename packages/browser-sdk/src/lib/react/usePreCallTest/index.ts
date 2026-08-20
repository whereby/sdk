import * as React from "react";
import { PreCallTestState } from "@whereby.com/core";
import { UsePreCallTestResult } from "./types";
import { WherebyContext } from "../Provider";

/**
 * Measures the connection between this client and the Whereby media servers, so
 * you can warn people about a bad network before they join a room.
 *
 * The test is never started for you - call `actions.startTest()`. It needs no
 * room and no local media, but it does compete for bandwidth with any call
 * already in progress, so run it before joining.
 */
export function usePreCallTest(roomUrl: string): UsePreCallTestResult {
    const client = React.useContext(WherebyContext)?.getPreCallTest();

    if (!client) {
        throw new Error("WherebyClient is not initialized. Please wrap your component with WherebyProvider.");
    }

    const [preCallTestState, setPreCallTestState] = React.useState<PreCallTestState>(() => client.getState());

    React.useEffect(() => {
        setPreCallTestState(client.getState());

        const unsubscribe = client.subscribe(setPreCallTestState);

        return () => {
            unsubscribe();

            if (client.getState().status === "running") {
                client.stopTest();
            }
        };
    }, [client]);

    const startTest = React.useCallback(() => {
        client.initialize({ roomUrl });
        return client.startTest();
    }, [client]);
    const stopTest = React.useCallback(() => client.stopTest(), [client]);

    return {
        state: preCallTestState,
        actions: {
            startTest,
            stopTest,
        },
    };
}
