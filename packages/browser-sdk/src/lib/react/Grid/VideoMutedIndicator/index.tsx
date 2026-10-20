import * as React from "react";

import { Avatar } from "../../Avatar";
import { useAudioElement } from "../../hooks/useAudioElement";

interface Props {
    avatarSize?: number;
    avatarUrl?: string;
    displayName: string;
    isSmallCell: boolean;
    withRoundedCorners: boolean;
    stream?: MediaStream | null;
    muted?: boolean;
}

function VideoMutedIndicator({
    avatarSize,
    avatarUrl,
    displayName,
    isSmallCell,
    withRoundedCorners,
    stream,
    muted,
}: Props) {
    const audioElRef = useAudioElement({ stream, muted });
    const size = avatarSize ?? (isSmallCell ? 60 : 80);
    return (
        <>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: "100%",
                    borderRadius: withRoundedCorners ? "8px" : "0",
                }}
            >
                <div
                    style={{
                        height: size,
                        width: size,
                        pointerEvents: "none",
                        position: "relative",
                    }}
                >
                    <Avatar variant={"square"} avatarUrl={avatarUrl} name={displayName} size={size} />
                </div>
            </div>
            <audio ref={audioElRef} autoPlay playsInline />
        </>
    );
}

export { VideoMutedIndicator };
