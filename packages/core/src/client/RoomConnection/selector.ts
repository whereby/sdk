import { createSelector } from "@reduxjs/toolkit";
import {
    selectLocalParticipantRaw,
    selectChatMessages,
    selectFileUploads,
    selectCloudRecordingRaw,
    selectRemoteParticipants,
    selectScreenshares,
    selectRoomConnectionStatus,
    selectRoomConnectionKnockResponse,
    selectWaitingParticipants,
    selectLiveTranscriptionRaw,
    selectLocalMediaStream,
    selectLocalScreenshareRaw,
    selectStreamingRaw,
    selectNotificationsEmitter,
    selectSpotlightedClientViews,
    selectBreakoutCurrentGroup,
    selectBreakoutCurrentId,
    selectBreakoutActive,
    selectBreakoutGroupedParticipants,
    selectBreakoutGroups,
    selectBreakoutAssignments,
    selectBreakoutEnforceAssignment,
    selectBreakoutTimerSetting,
    selectBreakoutTimerDuration,
    selectBreakoutAutoMoveToGroup,
    selectBreakoutMoveToGroupGracePeriod,
    selectBreakoutAutoMoveToMain,
    selectBreakoutMoveToMainGracePeriod,
    selectBreakoutStartedAt,
    selectBreakoutEndTime,
    selectBreakoutMoveToGroupAt,
    selectBreakoutMoveToMainAt,
    selectBreakoutIsAvailable,
    selectBreakoutError,
    selectAllClientViewsInCurrentGroup,
    selectRoomConnectionError,
    selectJoinRoomStage,
    selectIsCameraEnabled,
    selectIsMicrophoneEnabled,
    selectIsAudioOnlyModeEnabled,
    selectLiveCaptionsRaw,
    selectRoomIntegrationsRaw,
    selectEnabledRoomIntegrations,
    selectEmbeddableRoomIntegrations,
    selectRunningRoomIntegrations,
    selectRemoteParticipantQualityReport,
    RemoteParticipantQualityReport,
    selectLocalParticipantQualityReport,
    LocalParticipantQualityReport,
    selectRoomConnectionSessionId,
} from "../../redux";

import {
    BreakoutState,
    CloudRecordingState,
    LiveCaptionsState,
    LiveStreamState,
    LiveTranscriptionState,
    LocalParticipantState,
    LocalScreenshareState,
    RoomConnectionState,
    RoomIntegrationsState,
} from "./types";

const EMPTY_REMOTE_PARTICIPANT_QUALITY_REPORT: RemoteParticipantQualityReport = Object.freeze({});
const EMPTY_LOCAL_PARTICIPANT_QUALITY_REPORT: LocalParticipantQualityReport = Object.freeze({});

// The parts of the room connection state that are built from several values have their own selectors,
// so they're only rebuilt when those values change. Building them in selectRoomConnectionState would
// give them a new identity on every change to the room connection state, and notify their subscribers.
const selectRemoteParticipantsWithBreakoutAssignments = createSelector(
    selectRemoteParticipants,
    selectBreakoutAssignments,
    (remoteParticipants, breakoutAssignments) =>
        remoteParticipants.map((participant) => ({
            ...participant,
            breakoutGroupAssigned: breakoutAssignments?.[participant.deviceId] || "",
        })),
);

const selectCloudRecordingState = createSelector(
    selectCloudRecordingRaw,
    (cloudRecording): CloudRecordingState | undefined =>
        cloudRecording.status
            ? {
                  error: cloudRecording.error,
                  startedAt: cloudRecording.startedAt,
                  status: cloudRecording.status,
              }
            : undefined,
);

const selectBreakoutState = createSelector(
    selectBreakoutIsAvailable,
    selectBreakoutError,
    selectBreakoutActive,
    selectBreakoutCurrentId,
    selectBreakoutCurrentGroup,
    selectBreakoutGroups,
    selectBreakoutEnforceAssignment,
    selectBreakoutAutoMoveToGroup,
    selectBreakoutMoveToGroupGracePeriod,
    selectBreakoutAutoMoveToMain,
    selectBreakoutMoveToMainGracePeriod,
    selectBreakoutTimerSetting,
    selectBreakoutTimerDuration,
    selectBreakoutStartedAt,
    selectBreakoutEndTime,
    selectBreakoutMoveToGroupAt,
    selectBreakoutMoveToMainAt,
    selectBreakoutGroupedParticipants,
    selectAllClientViewsInCurrentGroup,
    selectSpotlightedClientViews,
    (
        breakoutIsAvailable,
        breakoutError,
        breakoutActive,
        breakoutCurrentId,
        breakoutCurrentGroup,
        breakoutGroups,
        breakoutEnforceAssignment,
        breakoutAutoMoveToGroup,
        breakoutMoveToGroupGracePeriod,
        breakoutAutoMoveToMain,
        breakoutMoveToMainGracePeriod,
        breakoutTimerSetting,
        breakoutTimerDuration,
        breakoutStartedAt,
        breakoutEndTime,
        breakoutMoveToGroupAt,
        breakoutMoveToMainAt,
        breakoutGroupedParticipants,
        clientViewsInCurrentGroup,
        spotlightedClientViews,
    ): BreakoutState => {
        // Main-room participants that are spotlighted broadcast their audio/video into every group.
        // Only relevant for participants who are currently inside a group.
        const broadcastingParticipants =
            breakoutActive && breakoutCurrentId
                ? spotlightedClientViews.filter((c) => !c.breakoutGroup && c.isAudioEnabled && !c.isPresentation)
                : [];

        return {
            isAvailable: breakoutIsAvailable,
            error: breakoutError,
            isActive: breakoutActive,
            currentGroup: breakoutCurrentGroup,
            groups: breakoutGroups ?? null,
            enforceAssignment: breakoutEnforceAssignment ?? false,
            autoMoveToGroup: breakoutAutoMoveToGroup ?? false,
            moveToGroupGracePeriod: breakoutMoveToGroupGracePeriod ?? null,
            autoMoveToMain: breakoutAutoMoveToMain ?? false,
            moveToMainGracePeriod: breakoutMoveToMainGracePeriod ?? null,
            breakoutTimerSetting: breakoutTimerSetting ?? false,
            breakoutTimerDuration: breakoutTimerDuration ?? 0,
            startedAt: breakoutStartedAt ?? null,
            endTime: breakoutEndTime,
            moveToGroupAt: breakoutMoveToGroupAt,
            moveToMainAt: breakoutMoveToMainAt,
            groupedParticipants: breakoutGroupedParticipants,
            participantsInCurrentGroup: clientViewsInCurrentGroup,
            broadcastingParticipants,
        };
    },
);

const selectLiveStreamState = createSelector(selectStreamingRaw, (streaming): LiveStreamState | undefined =>
    streaming.isStreaming
        ? {
              status: "streaming",
              startedAt: streaming.startedAt,
          }
        : undefined,
);

const selectLiveCaptionsState = createSelector(selectLiveCaptionsRaw, (liveCaptions): LiveCaptionsState | undefined =>
    liveCaptions.status
        ? {
              error: liveCaptions.error,
              startedAt: liveCaptions.startedAt,
              status: liveCaptions.status,
              captionLog: liveCaptions.captionLog,
          }
        : undefined,
);

const selectLiveTranscriptionState = createSelector(
    selectLiveTranscriptionRaw,
    (liveTranscription): LiveTranscriptionState | undefined =>
        liveTranscription.status
            ? {
                  error: liveTranscription.error,
                  startedAt: liveTranscription.startedAt,
                  status: liveTranscription.status,
              }
            : undefined,
);

const selectLocalScreenshareState = createSelector(
    selectLocalScreenshareRaw,
    (localScreenshare): LocalScreenshareState | undefined =>
        localScreenshare.status !== "inactive"
            ? {
                  error: localScreenshare.error,
                  startedAt: localScreenshare.startedAt,
                  status: {
                      starting: "requested",
                      active: "screensharing",
                      error: "error",
                  }[localScreenshare.status] as "requested" | "screensharing" | "error",
              }
            : undefined,
);

const selectLocalParticipantState = createSelector(
    selectLocalParticipantRaw,
    selectLocalScreenshareRaw,
    selectLocalMediaStream,
    (localParticipant, localScreenshare, localMediaStream): LocalParticipantState => ({
        ...localParticipant,
        isScreenSharing: localScreenshare.status === "active",
        stream: localMediaStream,
    }),
);

const selectRoomIntegrationsState = createSelector(
    selectRoomIntegrationsRaw,
    selectEnabledRoomIntegrations,
    selectEmbeddableRoomIntegrations,
    selectRunningRoomIntegrations,
    (
        roomIntegrationsRaw,
        enabledRoomIntegrations,
        embeddableRoomIntegrations,
        runningRoomIntegrations,
    ): RoomIntegrationsState => ({
        hasFetched: roomIntegrationsRaw.hasFetched,
        isFetching: roomIntegrationsRaw.isFetching,
        error: roomIntegrationsRaw.error,
        embeddable: embeddableRoomIntegrations,
        enabled: enabledRoomIntegrations,
        running: runningRoomIntegrations,
    }),
);

export const selectRoomConnectionState = createSelector(
    selectChatMessages,
    selectFileUploads,
    selectCloudRecordingState,
    selectBreakoutState,
    selectLiveCaptionsState,
    selectLiveTranscriptionState,
    selectLocalParticipantState,
    selectLocalScreenshareRaw,
    selectLocalScreenshareState,
    selectRemoteParticipantsWithBreakoutAssignments,
    selectScreenshares,
    selectRoomConnectionStatus,
    selectRoomConnectionError,
    selectJoinRoomStage,
    selectRoomConnectionKnockResponse,
    selectLiveStreamState,
    selectWaitingParticipants,
    selectNotificationsEmitter,
    selectSpotlightedClientViews,
    selectIsCameraEnabled,
    selectIsMicrophoneEnabled,
    selectRoomIntegrationsState,
    selectIsAudioOnlyModeEnabled,
    selectRemoteParticipantQualityReport,
    selectLocalParticipantQualityReport,
    selectRoomConnectionSessionId,
    (
        chatMessages,
        fileUploads,
        cloudRecording,
        breakout,
        liveCaptions,
        liveTranscription,
        localParticipant,
        localScreenshareRaw,
        localScreenshare,
        remoteParticipants,
        screenshares,
        connectionStatus,
        connectionError,
        joinStage,
        knockResponse,
        liveStream,
        waitingParticipants,
        notificationsEmitter,
        spotlightedClientViews,
        isCameraEnabled,
        isMicrophoneEnabled,
        roomIntegrations,
        isAudioOnlyModeEnabled,
        remoteParticipantQualityReport,
        localParticipantQualityReport,
        roomSessionId,
    ) => {
        const state: RoomConnectionState = {
            chatMessages,
            fileUploads,
            cloudRecording,
            breakout,
            remoteParticipantQualityReport: remoteParticipantQualityReport ?? EMPTY_REMOTE_PARTICIPANT_QUALITY_REPORT,
            localParticipantQualityReport: localParticipantQualityReport ?? EMPTY_LOCAL_PARTICIPANT_QUALITY_REPORT,
            connectionStatus,
            connectionError,
            joinStage,
            knockResponse,
            events: notificationsEmitter,
            isAudioOnlyModeEnabled,
            isCameraEnabled,
            isMicrophoneEnabled,
            liveStream,
            liveCaptions,
            liveTranscription,
            localScreenshareStatus: ["starting", "active"].includes(localScreenshareRaw.status)
                ? (localScreenshareRaw.status as "starting" | "active")
                : undefined,
            localScreenshare,
            localParticipant,
            remoteParticipants,
            roomIntegrations,
            roomSessionId: roomSessionId ?? null,
            screenshares,
            waitingParticipants,
            spotlightedParticipants: spotlightedClientViews,
        };

        return state;
    },
);
