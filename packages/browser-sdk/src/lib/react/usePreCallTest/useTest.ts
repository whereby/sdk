import * as React from "react";
import { PreCallTestStatus, Test, UseTestRef } from "./types";

export function useTestFactory(name: string, test: Test) {
    return function useTest(): UseTestRef {
        const [status, setStatus] = React.useState<PreCallTestStatus>("idle");
        const [output, setOutput] = React.useState("");

        React.useEffect(() => {
            async function runCameraTest() {
                test.addEventListener("output", (ev) => {
                    setOutput(`${name}: ${ev}`);
                });

                try {
                    await test.run();
                    setStatus("completed");
                } catch (error) {
                    setOutput(`${name}: ${error}`);
                    setStatus("failed");
                }
            }

            if (status === "running") {
                setOutput(`${name}: starting...`);
                runCameraTest();
            }
        }, [status]);

        return {
            description: "Camera test",
            state: { status, output },
            actions: {
                start: () => {
                    setStatus("running");
                },
                skip: () => {
                    setStatus("skipped");
                },
            },
        };
    };
}
