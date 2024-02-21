import * as React from "react";
import { PreCallTestStatus, Test, UseTestRef } from "./types";

interface UseTestFactoryOptions {
    description: string;
}

export function useTestFactory(id: string, test: Test, { description }: UseTestFactoryOptions = { description: "" }) {
    return function useTest(): UseTestRef {
        const [status, setStatus] = React.useState<PreCallTestStatus>("idle");
        const [output, setOutput] = React.useState<string[]>([]);

        React.useEffect(() => {
            async function runCameraTest() {
                test.addEventListener("output", (ev) => {
                    setOutput((output) => [...output, `${id}: ${ev}`]);
                });

                try {
                    await test.run();
                    setStatus("completed");
                } catch (error) {
                    setOutput((output) => [...output, `${id}: ${error}`]);
                    setStatus("failed");
                }
            }

            if (status === "running") {
                setOutput((output) => [...output, `${id}: starting...`]);
                runCameraTest();
            }
        }, [status]);

        return {
            id,
            description: description, // TODO: Replace with actual description
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
