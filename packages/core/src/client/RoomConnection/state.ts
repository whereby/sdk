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
    type RootState,
} from "../../redux";
import haveShallowEqualItems from "../../utils/haveShallowEqualItems";
import type { StateDefinition } from "../BaseClient";
import {
    AUDIO_ONLY_MODE_CHANGED,
    BREAKOUT_CONFIG_CHANGED,
    CAMERA_STATE_CHANGED,
    CHAT_MESSAGES_CHANGED,
    CLOUD_RECORDING_STATUS_CHANGED,
    CONNECTION_ERROR_CHANGED,
    CONNECTION_JOIN_STAGE_CHANGED,
    CONNECTION_KNOCK_RESPONSE_CHANGED,
    CONNECTION_STATUS_CHANGED,
    FILE_UPLOADS_CHANGED,
    LIVE_CAPTIONS_STATUS_CHANGED,
    LIVE_TRANSCRIPTION_STATUS_CHANGED,
    LOCAL_PARTICIPANT_CHANGED,
    LOCAL_PARTICIPANT_QUALITY_REPORT_CHANGED,
    LOCAL_SCREENSHARE_CHANGED,
    LOCAL_SCREENSHARE_STATUS_CHANGED,
    MICROPHONE_STATE_CHANGED,
    REMOTE_PARTICIPANT_QUALITY_REPORT_CHANGED,
    REMOTE_PARTICIPANTS_CHANGED,
    ROOM_INTEGRATIONS_CHANGED,
    ROOM_SESSION_ID_CHANGED,
    SCREENSHARE_STARTED,
    SCREENSHARE_STOPPED,
    SPOTLIGHT_PARTICIPANT_ADDED,
    SPOTLIGHT_PARTICIPANT_REMOVED,
    STREAMING_STARTED,
    STREAMING_STOPPED,
    WAITING_PARTICIPANT_JOINED,
    WAITING_PARTICIPANT_LEFT,
    type RoomConnectionEvents,
} from "./events";
import {
    BreakoutState,
    CloudRecordingState,
    LiveCaptionsState,
    LiveStreamState,
    LiveTranscriptionState,
    LocalParticipantState,
    LocalScreenshareState,
    LocalScreenshareStatus,
    RoomConnectionState,
    RoomIntegrationsState,
} from "./types";

const EMPTY_REMOTE_PARTICIPANT_QUALITY_REPORT: RemoteParticipantQualityReport = Object.freeze({});
const EMPTY_LOCAL_PARTICIPANT_QUALITY_REPORT: LocalParticipantQualityReport = Object.freeze({});

// The keys that are built from several values have memoized selectors, so they're only rebuilt
// when those values change.
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

// Main-room participants that are spotlighted broadcast their audio/video into every group.
// Only relevant for participants who are currently inside a group.
const selectBreakoutBroadcastingParticipants = createSelector(
    selectBreakoutActive,
    selectBreakoutCurrentId,
    selectSpotlightedClientViews,
    (breakoutActive, breakoutCurrentId, spotlightedClientViews) =>
        breakoutActive && breakoutCurrentId
            ? spotlightedClientViews.filter((c) => !c.breakoutGroup && c.isAudioEnabled && !c.isPresentation)
            : [],
    {
        memoizeOptions: {
            // Only produce a new array when its contents change, not whenever the spotlights change
            resultEqualityCheck: haveShallowEqualItems,
        },
    },
);

const selectBreakoutState = createSelector(
    selectBreakoutIsAvailable,
    selectBreakoutError,
    selectBreakoutActive,
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
    selectBreakoutBroadcastingParticipants,
    (
        breakoutIsAvailable,
        breakoutError,
        breakoutActive,
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
        broadcastingParticipants,
    ): BreakoutState => {
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

const selectLocalScreenshareStatus = (state: RootState): LocalScreenshareStatus | undefined => {
    const { status } = selectLocalScreenshareRaw(state);
    return status === "starting" || status === "active" ? status : undefined;
};

const emitAddedAndRemoved = <TItem extends { id: string }>(
    items: TItem[],
    previousItems: TItem[],
    onAdded: (item: TItem) => void,
    onRemoved: (id: string) => void,
) => {
    items.filter((item) => !previousItems.some(({ id }) => id === item.id)).forEach(onAdded);
    previousItems.filter((item) => !items.some(({ id }) => id === item.id)).forEach(({ id }) => onRemoved(id));
};

export const roomConnectionStateDefinition: StateDefinition<RoomConnectionState, RoomConnectionEvents> = {
    chatMessages: {
        selector: selectChatMessages,
        emit: (emit, messages) => emit(CHAT_MESSAGES_CHANGED, messages),
    },
    fileUploads: {
        selector: selectFileUploads,
        emit: (emit, uploads) => emit(FILE_UPLOADS_CHANGED, uploads),
    },
    cloudRecording: {
        selector: selectCloudRecordingState,
        emit: (emit, cloudRecording) => emit(CLOUD_RECORDING_STATUS_CHANGED, cloudRecording),
    },
    liveCaptions: {
        selector: selectLiveCaptionsState,
        emit: (emit, liveCaptions) => emit(LIVE_CAPTIONS_STATUS_CHANGED, liveCaptions),
    },
    liveTranscription: {
        selector: selectLiveTranscriptionState,
        emit: (emit, liveTranscription) => emit(LIVE_TRANSCRIPTION_STATUS_CHANGED, liveTranscription),
    },
    breakout: {
        selector: selectBreakoutState,
        emit: (emit, breakout) => emit(BREAKOUT_CONFIG_CHANGED, breakout),
    },
    connectionStatus: {
        selector: selectRoomConnectionStatus,
        emit: (emit, connectionStatus) => emit(CONNECTION_STATUS_CHANGED, connectionStatus),
    },
    connectionError: {
        selector: selectRoomConnectionError,
        emit: (emit, connectionError) => emit(CONNECTION_ERROR_CHANGED, connectionError),
    },
    joinStage: {
        selector: selectJoinRoomStage,
        emit: (emit, joinStage) => emit(CONNECTION_JOIN_STAGE_CHANGED, joinStage),
    },
    knockResponse: {
        selector: selectRoomConnectionKnockResponse,
        emit: (emit, knockResponse) => emit(CONNECTION_KNOCK_RESPONSE_CHANGED, knockResponse),
    },
    roomSessionId: {
        selector: (state) => selectRoomConnectionSessionId(state) ?? null,
        emit: (emit, roomSessionId) => emit(ROOM_SESSION_ID_CHANGED, roomSessionId),
    },
    isAudioOnlyModeEnabled: {
        selector: selectIsAudioOnlyModeEnabled,
        emit: (emit, isEnabled) => emit(AUDIO_ONLY_MODE_CHANGED, isEnabled),
    },
    remoteParticipantQualityReport: {
        selector: (state) => selectRemoteParticipantQualityReport(state) ?? EMPTY_REMOTE_PARTICIPANT_QUALITY_REPORT,
        emit: (emit, report) => emit(REMOTE_PARTICIPANT_QUALITY_REPORT_CHANGED, report),
    },
    localParticipantQualityReport: {
        selector: (state) => selectLocalParticipantQualityReport(state) ?? EMPTY_LOCAL_PARTICIPANT_QUALITY_REPORT,
        emit: (emit, report) => emit(LOCAL_PARTICIPANT_QUALITY_REPORT_CHANGED, report),
    },
    isCameraEnabled: {
        selector: selectIsCameraEnabled,
        emit: (emit, isCameraEnabled) => emit(CAMERA_STATE_CHANGED, isCameraEnabled),
    },
    isMicrophoneEnabled: {
        selector: selectIsMicrophoneEnabled,
        emit: (emit, isMicrophoneEnabled) => emit(MICROPHONE_STATE_CHANGED, isMicrophoneEnabled),
    },
    liveStream: {
        selector: selectLiveStreamState,
        emit: (emit, liveStream) => {
            if (liveStream?.status === "streaming") {
                emit(STREAMING_STARTED, liveStream);
            } else {
                emit(STREAMING_STOPPED);
            }
        },
    },
    localScreenshareStatus: {
        selector: selectLocalScreenshareStatus,
        emit: (emit, status) => emit(LOCAL_SCREENSHARE_STATUS_CHANGED, status),
    },
    localScreenshare: {
        selector: selectLocalScreenshareState,
        emit: (emit, localScreenshare) => emit(LOCAL_SCREENSHARE_CHANGED, localScreenshare),
    },
    localParticipant: {
        selector: selectLocalParticipantState,
        emit: (emit, localParticipant) => emit(LOCAL_PARTICIPANT_CHANGED, localParticipant),
    },
    remoteParticipants: {
        selector: selectRemoteParticipantsWithBreakoutAssignments,
        emit: (emit, remoteParticipants) => emit(REMOTE_PARTICIPANTS_CHANGED, remoteParticipants),
    },
    screenshares: {
        selector: selectScreenshares,
        emit: (emit, screenshares, previousScreenshares) =>
            emitAddedAndRemoved(
                screenshares,
                previousScreenshares,
                (screenshare) => emit(SCREENSHARE_STARTED, screenshare),
                (id) => emit(SCREENSHARE_STOPPED, id),
            ),
    },
    waitingParticipants: {
        selector: selectWaitingParticipants,
        emit: (emit, waitingParticipants, previousWaitingParticipants) =>
            emitAddedAndRemoved(
                waitingParticipants,
                previousWaitingParticipants,
                (participant) => emit(WAITING_PARTICIPANT_JOINED, participant),
                (id) => emit(WAITING_PARTICIPANT_LEFT, id),
            ),
    },
    spotlightedParticipants: {
        selector: selectSpotlightedClientViews,
        emit: (emit, spotlighted, previousSpotlighted) =>
            emitAddedAndRemoved(
                spotlighted,
                previousSpotlighted,
                (participant) => emit(SPOTLIGHT_PARTICIPANT_ADDED, participant),
                (id) => emit(SPOTLIGHT_PARTICIPANT_REMOVED, id),
            ),
    },
    roomIntegrations: {
        selector: selectRoomIntegrationsState,
        emit: (emit, roomIntegrations) => emit(ROOM_INTEGRATIONS_CHANGED, roomIntegrations),
    },
    // The notifications emitter is fixed for the lifetime of the store, and has its own events
    events: {
        selector: selectNotificationsEmitter,
        emit: null,
    },
};
