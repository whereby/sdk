import * as React from "react";
import { usePreCallCheck } from "../../lib/react/usePreCallCheck";

export default function PreCallCheck() {
    const { state } = usePreCallCheck();

    return (
        <div>
            <div>Overall status: {state.status}</div>
            <div>Checks:</div>
            {state.checks.map((check) => (
                <div key={check.id} style={{ borderBottom: "1px solid #ccc", padding: 20 }}>
                    <p>{check.description}</p>
                    <span>{check.state.status}</span>
                    {check.state.status === "running" && (
                        <div>
                            <span>Test output</span>
                            {check.state.output.map((output) => (
                                <div key={output}>{output}</div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
