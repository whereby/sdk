import * as React from "react";
import VideoExperience from "./components/VideoExperience";
import "./styles.css";
import { Provider as WherebyProvider } from "../lib/react/Provider";
import { StoryObj } from "@storybook/react-vite";
import { decremented, incremented, Provider, selectCount } from "./redux-store";
import { useDispatch, useSelector } from "react-redux";

// This is to test that the SDK works with a redux store in the consumer app, without interfering with the SDK's own redux store.
const defaultArgs: StoryObj = {
    name: "Examples/Custom UI with Redux",
    argTypes: {
        displayName: { control: "text" },
        roomUrl: { control: "text", type: { required: true } },
        externalId: { control: "text" },
    },
    args: {
        displayName: "SDK",
        roomUrl: process.env.STORYBOOK_ROOM,
    },
    decorators: [
        (Story) => (
            <WherebyProvider>
                <Provider>
                    <Story />
                </Provider>
            </WherebyProvider>
        ),
    ],
};

export default defaultArgs;

const roomRegEx = new RegExp(/^https:\/\/.*\/.*/);

export const RoomConnectionWithRedux = ({ roomUrl, displayName }: { roomUrl: string; displayName?: string }) => {
    if (!roomUrl || !roomUrl.match(roomRegEx)) {
        return <p>Set room url on the Controls panel</p>;
    }
    const dispatch = useDispatch();
    const count = useSelector(selectCount);

    return (
        <>
            <button onClick={() => dispatch(incremented())}>Increment</button>
            <button onClick={() => dispatch(decremented())}>Decrement</button>
            <p>Count: {count}</p>
            <VideoExperience displayName={displayName} roomName={roomUrl} />
        </>
    );
};
