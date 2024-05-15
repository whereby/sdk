import * as React from "react";

import { Avatar } from "../../Avatar";

interface Props {
    avatarUrl?: string;
    displayName: string;
    isSmallCell: boolean;
    withRoundedCorners: boolean;
}

function VideoMutedIndicator({ avatarUrl, displayName, isSmallCell, withRoundedCorners }: Props) {
    return (
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
                    height: isSmallCell ? 60 : 80,
                    width: isSmallCell ? 60 : 80,
                    pointerEvents: "none",
                    position: "relative",
                }}
            >
                <Avatar variant={"square"} avatarUrl={avatarUrl} name={displayName} size={isSmallCell ? 60 : 80} />
            </div>
        </div>
    );
}

export { VideoMutedIndicator };
