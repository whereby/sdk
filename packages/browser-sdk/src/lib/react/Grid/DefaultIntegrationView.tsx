import * as React from "react";
import { RoomIntegrationSessionView } from "@whereby.com/core";

import { useRoomIntegrationView } from "../useRoomIntegrationView";

const IFRAME_STYLE: React.CSSProperties = { border: "none", width: "100%", height: "100%" };

/**
 * What the grid renders for a running integration when the consumer passes no `renderIntegration`.
 */
function DefaultIntegrationView({ session }: { session: RoomIntegrationSessionView }) {
    const { iframeProps } = useRoomIntegrationView({ session });

    return iframeProps ? <iframe {...iframeProps} allowFullScreen style={IFRAME_STYLE} /> : null;
}

export { DefaultIntegrationView };
