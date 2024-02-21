import * as React from "react";
import { BandwidthTest } from "./bandwidthTest";
import { CameraTest } from "./cameraTest";
import { MicrophoneTest } from "./microphoneTest";
import { PreCallTestStatus, UseTestRef } from "./types";
import { useTestFactory } from "./useTest";

interface PreCallTestOptions {
    autoStart?: boolean;
    language?: string;
}

type TestType = "bandwidth" | "camera" | "microphone";

interface PrecallTestState {
    status: PreCallTestStatus;
    currentTest: TestType | null;
    tests: UseTestRef[];
}

interface PrecallTestRef {
    state: PrecallTestState;
}

type TestLookup = {
    [key in TestType]: UseTestRef;
};

const useBandwidthTest = useTestFactory("bandwidth", new BandwidthTest(), {
    description: "Checks whether your connection has enough bandwidth for a satisfactory call experience",
});
const useCameraTest = useTestFactory("camera", new CameraTest(), {
    description: "Tries to get access to your local camera and verify the ability to retrieve a video track",
});
const useMicrophoneTest = useTestFactory("microphone", new MicrophoneTest(), {
    description: "Checks whether you have or are able to give microphone permissions",
});

export function usePreCallTest(options: PreCallTestOptions = { autoStart: true }): PrecallTestRef {
    if (!options) {
        throw new Error("options is required");
    }

    const [currentTest, setCurrentTest] = React.useState<TestType>("camera");
    const [testList] = React.useState<TestType[]>(["camera", "microphone", "bandwidth"]);

    // Initialize all possible tests
    const tests: TestLookup = {
        bandwidth: useBandwidthTest(),
        camera: useCameraTest(),
        microphone: useMicrophoneTest(),
    };

    // Optionally start the first test
    React.useEffect(() => {
        console.log("Effect");

        const { actions, state } = tests[currentTest];
        const { status: currentTestStatus } = state;

        if (currentTestStatus === "idle") {
            console.log("Starting test:", currentTest);
            actions.start();
        } else if (currentTestStatus === "running") {
            console.log("Test is running:", currentTest);
        } else if (currentTestStatus === "failed") {
            const nextTestIdx = testList.indexOf(currentTest) + 1;
            for (let index = nextTestIdx; index < testList.length; index++) {
                const testNameToSkip = testList[index];
                tests[testNameToSkip].actions.skip();
            }
        } else if (currentTestStatus === "completed") {
            const nextTestIdx = testList.indexOf(currentTest) + 1;
            const nextTest = testList[nextTestIdx];
            console.log("Test completed:", currentTest);
            if (nextTest) {
                console.log("Next test:", nextTest);
                setCurrentTest(nextTest);
            } else {
                console.log("All tests completed");
            }
        }
    }, [`${currentTest}-${tests[currentTest].state.status}`]);

    // Computed values
    const allIdle = Object.values(tests).every((test) => test.state.status === "idle");
    const allCompleted = Object.values(tests).every((test) => test.state.status === "completed");
    const someFailed = Object.values(tests).some((test) => test.state.status === "failed");

    const status = allIdle ? "idle" : allCompleted ? "completed" : someFailed ? "failed" : "running";

    // Always render tests state directly from the hook
    return { state: { status, currentTest, tests: testList.map((t) => tests[t]) } };
}
