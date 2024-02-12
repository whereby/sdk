import { createSelector } from "@reduxjs/toolkit";
import { RoomConnectionState } from "./types";

import { selectChatMessages } from "@whereby.com/core";
import { selectCloudRecordingRaw } from "@whereby.com/core";
import { selectRemoteParticipants, selectScreenshares } from "@whereby.com/core";
import { selectRoomConnectionStatus } from "@whereby.com/core";
import { selectWaitingParticipants } from "@whereby.com/core";
import { selectLocalParticipantRaw } from "@whereby.com/core";
import { selectLocalMediaStream } from "@whereby.com/core";
import { selectStreamingRaw } from "@whereby.com/core";

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
        };

        return state;
    },
);
