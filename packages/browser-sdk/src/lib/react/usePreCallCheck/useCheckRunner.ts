import * as React from "react";
import { CheckStatus, UseCheckRef } from "./types";

type Logger = Pick<Console, "debug">;
interface CheckRunnerFactoryOptions {
    logger: Logger;
}

interface CheckRunnerDefinitions {
    [key: string]: () => UseCheckRef;
}

interface CheckRunnerOptions {
    autoStart?: boolean;
    language?: string;
}

interface CheckRunnerState {
    status: CheckStatus;
    currentCheck: string | null;
    checks: UseCheckRef[];
}

export interface CheckRunnerRef {
    state: CheckRunnerState;
}

export function useCheckRunnerFactory(
    checkDefinitions: CheckRunnerDefinitions,
    options: CheckRunnerFactoryOptions = { logger: { debug: () => {} } },
) {
    const { logger } = options;

    const checkList = Object.keys(checkDefinitions);

    return function useCheckRunner(options: CheckRunnerOptions = { autoStart: true }): CheckRunnerRef {
        if (!options) {
            throw new Error("options is required");
        }

        const [currentCheck, setCurrentCheck] = React.useState<string>(checkList[0]);
        const checks: { [key: string]: UseCheckRef } = Object.entries(checkDefinitions).reduce((acc, [key, value]) => {
            return {
                ...acc,
                [key]: value(),
            };
        }, {});

        // Optionally start the first check
        React.useEffect(() => {
            logger.debug("CheckRunner useEffect...");

            const { actions, state } = checks[currentCheck];
            const { status: currentCheckStatus } = state;

            if (currentCheckStatus === "idle") {
                logger.debug("Starting check:", currentCheck);
                actions.start();
            } else if (currentCheckStatus === "running") {
                logger.debug("Check is running:", currentCheck);
            } else if (currentCheckStatus === "failed") {
                logger.debug("Check failed:", currentCheck);
                const nextCheckIdx = checkList.indexOf(currentCheck) + 1;
                for (let index = nextCheckIdx; index < checkList.length; index++) {
                    const checkToSkip = checkList[index];
                    checks[checkToSkip].actions.skip();
                }
            } else if (currentCheckStatus === "completed") {
                logger.debug("Check completed:", currentCheck);
                const nextCheckIdx = checkList.indexOf(currentCheck) + 1;
                const nextCheck = checkList[nextCheckIdx];

                if (nextCheck) {
                    logger.debug("Next check:", nextCheck);
                    setCurrentCheck(nextCheck);
                } else {
                    logger.debug("All checks completed");
                }
            }
        }, [`${currentCheck}-${checks[currentCheck].state.status}`]);

        // Computed overall status based on individual checks
        const allIdle = Object.values(checks).every((check) => check.state.status === "idle");
        const allCompleted = Object.values(checks).every((check) => check.state.status === "completed");
        const someFailed = Object.values(checks).some((check) => check.state.status === "failed");

        const status = allIdle ? "idle" : allCompleted ? "completed" : someFailed ? "failed" : "running";

        // Always render check state directly from the hook
        return { state: { status, currentCheck: currentCheck, checks: checkList.map((t) => checks[t]) } };
    };
}
