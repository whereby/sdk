import * as React from "react";
import { usePreCallTest } from "../../lib/react/usePreCallTest";

export default function PreCallTest() {
    const { state } = usePreCallTest();

    return (
        <div>
            <div>Overall status: {state.status}</div>
            <div>Tests:</div>
            {state.tests.map((test) => (
                <div key={test.id} style={{ borderBottom: "1px solid #ccc", padding: 20 }}>
                    <p>{test.description}</p>
                    <span>{test.state.status}</span>
                    {test.state.status === "running" && (
                        <div>
                            <span>Test output</span>
                            {test.state.output.map((output) => (
                                <div key={output}>{output}</div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
