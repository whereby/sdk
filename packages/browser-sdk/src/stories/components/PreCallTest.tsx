import * as React from "react";
import { usePreCallTest } from "../../lib/react/usePreCallTest";

export default function PreCallTest() {
    const { state } = usePreCallTest();

    return (
        <div>
            <div>Overall status: {state.status}</div>
            <div>Tests:</div>
            {Object.values(state.tests).map((test) => (
                <div>{test.state.status}</div>
            ))}
        </div>
    );
}
