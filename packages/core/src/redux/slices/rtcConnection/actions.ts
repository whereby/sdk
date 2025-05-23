import { createAction } from "@reduxjs/toolkit";
import {
    RtcClientConnectionStatusChangedPayload,
    RtcManagerCreatedPayload,
    RtcStreamAddedPayload,
} from "@whereby.com/media";

function createRtcEventAction<T>(name: string) {
    return createAction<T>(`rtcConnection/event/${name}`);
}

export const rtcEvents = {
    rtcManagerCreated: createRtcEventAction<RtcManagerCreatedPayload>("rtcManagerCreated"),
    rtcManagerDestroyed: createRtcEventAction<void>("rtcManagerDestroyed"),
    streamAdded: createRtcEventAction<RtcStreamAddedPayload>("streamAdded"),
    clientConnectionStatusChanged: createRtcEventAction<RtcClientConnectionStatusChangedPayload>(
        "clientConnectionStatusChanged",
    ),
};
