import * as React from "react";

import { Meta } from "@storybook/react-vite";
import "./styles.css";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import { usePreCallTest } from "../lib/react";
import PreCallTestExperience from "./components/PreCallTestExperience";
import VideoExperience from "./components/VideoExperience";

const defaultArgs: Meta = {
    title: "Examples/Pre-call test",
    argTypes: {
        roomUrl: { control: "text" },
        displayName: { control: "text" },
    },
    args: {
        roomUrl: process.env.STORYBOOK_ROOM,
        displayName: "SDK",
    },
    decorators: [
        (Story) => (
            <WherebyProvider>
                <Story />
            </WherebyProvider>
        ),
    ],
};

export default defaultArgs;

const roomRegEx = new RegExp(/^https:\/\/.*\/.*/);

export const BandwidthTest = () => {
    return <PreCallTestExperience />;
};

/**
 * The test survives the component that started it: unmounting a finished test
 * keeps its result around for the next reader, while unmounting a running test
 * stops it so it no longer eats bandwidth.
 */
export const BandwidthTestUnmount = () => {
    const [isMounted, setIsMounted] = React.useState(true);

    return (
        <div>
            <div className="controls">
                <button onClick={() => setIsMounted(!isMounted)}>
                    {isMounted ? "Unmount pre-call test" : "Mount pre-call test"}
                </button>
            </div>
            {isMounted ? (
                <PreCallTestExperience />
            ) : (
                <p>Unmounted. Mount again to see the state the test was left in.</p>
            )}
        </div>
    );
};

/**
 * Warn people about a bad connection before they join. Run the test first, then
 * let them join anyway if they want to.
 */
export const BandwidthTestBeforeJoiningRoom = ({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) => {
    const {
        state: { status, result },
        actions: { startTest },
    } = usePreCallTest();
    const [hasJoined, setHasJoined] = React.useState(false);

    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }

    if (hasJoined) {
        return <VideoExperience displayName={displayName} roomName={roomUrl} />;
    }

    return (
        <div>
            <h3>Check your connection before joining</h3>
            <div className="controls">
                <button onClick={() => startTest()} disabled={status === "running"}>
                    {status === "running" ? "Testing connection..." : "Test connection"}
                </button>
                <button onClick={() => setHasJoined(true)}>Join room</button>
            </div>
            {status === "failed" && <p>We could not test your connection. You can still join.</p>}
            {result &&
                (result.success ? (
                    <p className="preCallTestVerdictSuccess">Your connection looks good.</p>
                ) : (
                    <p className="preCallTestVerdictWarning">
                        Your connection may struggle with video ({result.details.recvAvailableBitrate.toFixed(2)} Mbps
                        available). Consider turning your camera off.
                    </p>
                ))}
        </div>
    );
};
