import { createAction } from "@reduxjs/toolkit";

import {
    AudioEnabledEvent,
    BreakoutGroupJoinedEvent,
    ChatMessage,
    ChatMessageRemoved,
    ChatMessageError,
    ClientLeftEvent,
    ClientKickedEvent,
    ClientMetadataReceivedEvent,
    ClientUnableToJoinEvent,
    CloudRecordingStartedEvent,
    KnockerLeftEvent,
    KnockAcceptedEvent,
    KnockOnHoldEvent,
    KnockRejectedEvent,
    LiveCaptionsStartedEvent,
    LiveCaptionsStoppedEvent,
    LiveCaptionEvent,
    LiveTranscriptionStartedEvent,
    LiveTranscriptionStoppedEvent,
    NewClientEvent,
    RoomIntegrationStartedEvent,
    RoomIntegrationStoppedEvent,
    RoomIntegrationPropsUpdatedEvent,
    RoomIntegrationEnabledEvent,
    RoomIntegrationDisabledEvent,
    RoomJoinedEvent,
    RoomKnockedEvent,
    RoomLockedEvent,
    ScreenshareStartedEvent,
    ScreenshareStoppedEvent,
    ScreenshareEnableRequestedEvent,
    VideoEnabledEvent,
    RoomSessionEndedEvent,
    AudioEnableRequestedEvent,
    SpotlightAddedEvent,
    SpotlightRemovedEvent,
    VideoEnableRequestedEvent,
    BreakoutSessionUpdatedEvent,
} from "@whereby.com/media";

export interface SignalDisconnectEvent {
    /** Whether the signal socket will try to reconnect on its own. */
    willReconnect: boolean;
}

// socket.io doesn't retry after these disconnect reasons. It reconnects on its own after any other reason.
const NON_RECONNECTING_DISCONNECT_REASONS = ["io server disconnect", "io client disconnect"];

/**
 * Create a SignalDisconnectEvent from the reason the signal socket's `disconnect` event gives.
 * Without a reason we can't tell that the socket is reconnecting, so it's treated as a deliberate disconnect.
 */
export function createSignalDisconnectEvent(reason?: string): SignalDisconnectEvent {
    return {
        willReconnect: !!reason && !NON_RECONNECTING_DISCONNECT_REASONS.includes(reason),
    };
}

function createSignalEventAction<T>(name: string) {
    return createAction<T>(`signalConnection/event/${name}`);
}

export const signalEvents = {
    audioEnabled: createSignalEventAction<AudioEnabledEvent>("audioEnabled"),
    audioEnableRequested: createSignalEventAction<AudioEnableRequestedEvent>("audioEnableRequested"),
    breakoutGroupJoined: createSignalEventAction<BreakoutGroupJoinedEvent>("breakoutGroupJoined"),
    breakoutMoveToGroup: createSignalEventAction<void>("breakoutMoveToGroup"),
    breakoutMoveToMain: createSignalEventAction<void>("breakoutMoveToMain"),
    breakoutSessionUpdated: createSignalEventAction<BreakoutSessionUpdatedEvent>("breakoutSessionUpdated"),
    breakoutEnding: createSignalEventAction<void>("breakoutEnding"),
    breakoutTimerEnded: createSignalEventAction<void>("breakoutTimerEnded"),
    breakoutTimerExtended: createSignalEventAction<void>("breakoutTimerExtended"),
    chatMessage: createSignalEventAction<ChatMessage>("chatMessage"),
    chatMessageRemoved: createSignalEventAction<ChatMessageRemoved>("chatMessageRemoved"),
    fileSharingError: createSignalEventAction<ChatMessageError>("fileSharingError"),
    clientLeft: createSignalEventAction<ClientLeftEvent>("clientLeft"),
    clientKicked: createSignalEventAction<ClientKickedEvent>("clientKicked"),
    clientMetadataReceived: createSignalEventAction<ClientMetadataReceivedEvent>("clientMetadataReceived"),
    clientUnableToJoin: createSignalEventAction<ClientUnableToJoinEvent>("clientUnableToJoin"),
    cloudRecordingStarted: createSignalEventAction<CloudRecordingStartedEvent>("cloudRecordingStarted"),
    cloudRecordingStopped: createSignalEventAction<void>("cloudRecordingStopped"),
    disconnect: createSignalEventAction<SignalDisconnectEvent>("disconnect"),
    knockerLeft: createSignalEventAction<KnockerLeftEvent>("knockerLeft"),
    knockHandled: createSignalEventAction<KnockAcceptedEvent | KnockOnHoldEvent | KnockRejectedEvent>("knockHandled"),
    newClient: createSignalEventAction<NewClientEvent>("newClient"),
    roomIntegrationStarted: createSignalEventAction<RoomIntegrationStartedEvent>("roomIntegrationStarted"),
    roomIntegrationStopped: createSignalEventAction<RoomIntegrationStoppedEvent>("roomIntegrationStopped"),
    roomIntegrationPropsUpdated:
        createSignalEventAction<RoomIntegrationPropsUpdatedEvent>("roomIntegrationPropsUpdated"),
    roomIntegrationEnabled: createSignalEventAction<RoomIntegrationEnabledEvent>("roomIntegrationEnabled"),
    roomIntegrationDisabled: createSignalEventAction<RoomIntegrationDisabledEvent>("roomIntegrationDisabled"),
    roomJoined: createSignalEventAction<RoomJoinedEvent>("roomJoined"),
    roomKnocked: createSignalEventAction<RoomKnockedEvent>("roomKnocked"),
    roomLeft: createSignalEventAction<void>("roomLeft"),
    roomLocked: createSignalEventAction<RoomLockedEvent>("roomLocked"),
    roomSessionEnded: createSignalEventAction<RoomSessionEndedEvent>("roomSessionEnded"),
    screenshareStarted: createSignalEventAction<ScreenshareStartedEvent>("screenshareStarted"),
    screenshareStopped: createSignalEventAction<ScreenshareStoppedEvent>("screenshareStopped"),
    screenshareEnableRequested: createSignalEventAction<ScreenshareEnableRequestedEvent>("screenshareEnableRequested"),
    spotlightAdded: createSignalEventAction<SpotlightAddedEvent>("spotlightAdded"),
    spotlightRemoved: createSignalEventAction<SpotlightRemovedEvent>("spotlightRemoved"),
    streamingStopped: createSignalEventAction<void>("streamingStopped"),
    videoEnabled: createSignalEventAction<VideoEnabledEvent>("videoEnabled"),
    videoEnableRequested: createSignalEventAction<VideoEnableRequestedEvent>("videoEnableRequested"),
    liveTranscriptionStarted: createSignalEventAction<LiveTranscriptionStartedEvent>("liveTranscriptionStarted"),
    liveTranscriptionStopped: createSignalEventAction<LiveTranscriptionStoppedEvent>("liveTranscriptionStopped"),
    liveCaptionsStarted: createSignalEventAction<LiveCaptionsStartedEvent>("liveCaptionsStarted"),
    liveCaptionsStopped: createSignalEventAction<LiveCaptionsStoppedEvent>("liveCaptionsStopped"),
    liveCaption: createSignalEventAction<LiveCaptionEvent>("liveCaption"),
};
