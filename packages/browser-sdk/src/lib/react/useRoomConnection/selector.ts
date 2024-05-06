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
        };

        return state;
    },
);
