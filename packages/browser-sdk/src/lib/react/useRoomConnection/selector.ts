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
    selectNotificationsEmitter,
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
    selectNotificationsEmitter,
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
        notificationsEmitter,
        spotlightedClientViews,
    ) => {
        const state: RoomConnectionState = {
            chatMessages,
            cloudRecording: cloudRecording.isRecording ? { status: "recording" } : undefined,
            connectionStatus,
            events: notificationsEmitter,
            liveStream: streaming.isStreaming
                ? {
                      status: "streaming",
                      startedAt: streaming.startedAt,
                  }
                : undefined,
            localScreenshareStatus: localParticipant.isScreenSharing ? "active" : undefined,
            localParticipant: { ...localParticipant, stream: localMediaStream },
            remoteParticipants,
            screenshares,
            waitingParticipants,
            spotlightedParticipants: spotlightedClientViews,
        };

        return state;
    },
);
