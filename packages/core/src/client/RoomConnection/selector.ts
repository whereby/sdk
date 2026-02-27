import { createSelector } from "@reduxjs/toolkit";
import {
    selectLocalParticipantRaw,
    selectChatMessages,
    selectCloudRecordingRaw,
    selectRemoteParticipants,
    selectScreenshares,
    selectRoomConnectionStatus,
    selectWaitingParticipants,
    selectLocalMediaStream,
    selectStreamingRaw,
    selectNotificationsEmitter,
    selectSpotlightedClientViews,
    selectBreakoutCurrentGroup,
    selectBreakoutActive,
    selectBreakoutGroupedParticipants,
    selectAllClientViewsInCurrentGroup,
    selectRoomConnectionError,
} from "../../redux";

import { RoomConnectionState } from "./types";

export const selectRoomConnectionState = createSelector(
    selectChatMessages,
    selectCloudRecordingRaw,
    selectBreakoutCurrentGroup,
    selectBreakoutActive,
    selectBreakoutGroupedParticipants,
    selectAllClientViewsInCurrentGroup,
    selectLocalParticipantRaw,
    selectLocalMediaStream,
    selectRemoteParticipants,
    selectScreenshares,
    selectRoomConnectionStatus,
    selectRoomConnectionError,
    selectStreamingRaw,
    selectWaitingParticipants,
    selectNotificationsEmitter,
    selectSpotlightedClientViews,
    (
        chatMessages,
        cloudRecording,
        breakoutCurrentGroup,
        breakoutActive,
        breakoutGroupedParticipants,
        clientViewsInCurrentGroup,
        localParticipant,
        localMediaStream,
        remoteParticipants,
        screenshares,
        connectionStatus,
        connectionError,
        streaming,
        waitingParticipants,
        notificationsEmitter,
        spotlightedClientViews,
    ) => {
        const state: RoomConnectionState = {
            chatMessages,
            cloudRecording: cloudRecording.isRecording ? { status: "recording" } : undefined,
            breakout: {
                isActive: breakoutActive,
                currentGroup: breakoutCurrentGroup,
                groupedParticipants: breakoutGroupedParticipants,
                participantsInCurrentGroup: clientViewsInCurrentGroup,
            },
            connectionStatus,
            connectionError,
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
