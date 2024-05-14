import { createSelector } from "@reduxjs/toolkit";
import {
    selectChatMessages,
    selectCloudRecordingRaw,
    selectRemoteParticipants,
    selectScreenshares,
    selectRoomConnectionStatus,
    selectWaitingParticipants,
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    selectStreamingRaw,
    selectSpotlightedClientViews,
} from "@whereby.com/core";

import { RoomConnectionState } from "./types";

export const selectRoomConnectionState = createSelector(
    selectChatMessages,
    selectCloudRecordingRaw,
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    selectRemoteParticipants,
    selectScreenshares,
    selectRoomConnectionStatus,
    selectStreamingRaw,
    selectWaitingParticipants,
    selectSpotlightedClientViews,
    (
        chatMessages,
        cloudRecording,
        localParticipant,
        localMediaStream,
        remoteParticipants,
        screenshares,
        connectionStatus,
        streaming,
        waitingParticipants,
        spotlightedClientViews,
    ) => {
        const state: RoomConnectionState = {
            chatMessages,
            cloudRecording: cloudRecording.isRecording ? { status: "recording" } : undefined,
            localScreenshareStatus: localParticipant.isScreenSharing ? "active" : undefined,
            localParticipant: { ...localParticipant, stream: localMediaStream },
            remoteParticipants,
            screenshares,
            connectionStatus,
            liveStream: streaming.isStreaming
                ? {
                      status: "streaming",
                      startedAt: streaming.startedAt,
                  }
                : undefined,
            waitingParticipants,
            spotlightedParticipants: spotlightedClientViews,
        };

        return state;
    },
);
