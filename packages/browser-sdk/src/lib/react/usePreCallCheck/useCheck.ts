import * as React from "react";
import { CheckStatus, Check, UseCheckRef } from "./types";

interface UseCheckFactoryOptions {
    description: string;
}

export function useCheckFactory(
    id: string,
    check: Check,
    { description }: UseCheckFactoryOptions = { description: "" },
) {
    return function useCheck(): UseCheckRef {
        const [status, setStatus] = React.useState<CheckStatus>("pending");
        const [output, setOutput] = React.useState<string[]>([]);

        React.useEffect(() => {
            async function runCheck() {
                check.addEventListener("output", (ev) => {
                    setOutput((output) => [...output, `${id}: ${ev}`]);
                });

                try {
                    await check.run();
                    setStatus("succeeded");
                } catch (error) {
                    setOutput((output) => [...output, `${id}: ${error}`]);
                    setStatus("failed");
                }
            }

            if (status === "running") {
                setOutput((output) => [...output, `${id}: starting...`]);
                runCheck();
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
