"use client";

import * as React from "react";

import { useRoomConnection, VideoGrid } from "@whereby.com/browser-sdk/react";

interface Props {
    roomUrl: string;
}

function Room({ roomUrl }: Props) {
    const { actions } = useRoomConnection(roomUrl, { localMediaOptions: { audio: true, video: true } });
    const { joinRoom, leaveRoom } = actions;

    React.useEffect(() => {
        joinRoom();
        return () => leaveRoom();
    }, [joinRoom, leaveRoom]);

    return (
        <div className={"w-full h-full"}>
            <VideoGrid />
        </div>
    );
}

export default Room;
