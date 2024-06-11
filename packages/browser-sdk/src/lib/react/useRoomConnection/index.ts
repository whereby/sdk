import * as React from "react";
import {
    AppConfig,
    doSendChatMessage,
    doStartCloudRecording,
    doStopCloudRecording,
    doAcceptWaitingParticipant,
    doRejectWaitingParticipant,
    doRequestAudioEnable,
    doSetDisplayName,
    doSetLocalStickyReaction,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
    toggleLowDataModeEnabled,
    doStartScreenshare,
    doStopScreenshare,
    doAppStart,
    doAppStop,
    doKnockRoom,
    doLockRoom,
    doKickParticipant,
    doEndMeeting,
    doSpotlightParticipant,
    doRemoveSpotlight,
    NotificationsEventEmitter,
    AppThunk,
} from "@whereby.com/core";
import { UnknownAction } from "@reduxjs/toolkit";

import { selectRoomConnectionState } from "./selector";
import { RoomConnectionState, RoomConnectionActions, UseRoomConnectionOptions } from "./types";
import { browserSdkVersion } from "../version";
import { useAppDispatch, useAppSelector } from "../Provider/hooks";

export type RoomConnectionRef = {
    state: Omit<RoomConnectionState, "events">;
    actions: RoomConnectionActions;
    events?: NotificationsEventEmitter;
};

const defaultRoomConnectionOptions: UseRoomConnectionOptions = {
    localMediaOptions: {
        audio: true,
        video: true,
    },
};

export function useRoomConnection(
    roomUrl: string,
    roomConnectionOptions = defaultRoomConnectionOptions,
): RoomConnectionRef {
    const dispatch = useAppDispatch();
    const roomConnectionState = useAppSelector(selectRoomConnectionState);

    const roomConfig = React.useMemo((): AppConfig => {
        const url = new URL(roomUrl); // Throw if invalid Whereby room url
        const searchParams = new URLSearchParams(url.search);
        const roomKey = roomConnectionOptions.roomKey || searchParams.get("roomKey");

        return {
            displayName: roomConnectionOptions.displayName || "Guest",
            localMediaOptions: roomConnectionOptions.localMedia ? undefined : roomConnectionOptions.localMediaOptions,
            roomKey,
            roomUrl,
            userAgent: `browser-sdk:${browserSdkVersion}`,
            externalId: roomConnectionOptions.externalId || null,
        };
    }, [roomUrl, roomConnectionOptions]);

    React.useEffect(() => {
        return () => {
            dispatch(doAppStop());
        };
    }, []);

    const whenConnectedToRoom = React.useCallback(
        (actionCreator: () => AppThunk | UnknownAction) => {
            if (roomConnectionState.connectionStatus === "connected") {
                dispatch(actionCreator());
            } else {
                console.warn("Action cannot be performed outside of a connected room");
            }
        },
        [roomConnectionState.connectionStatus, dispatch],
    );

    const sendChatMessage = React.useCallback(
        (text: string) => whenConnectedToRoom(() => doSendChatMessage({ text })),
        [whenConnectedToRoom],
    );
    const knock = React.useCallback(() => dispatch(doKnockRoom()), [dispatch]);
    const setDisplayName = (displayName: string) => whenConnectedToRoom(() => doSetDisplayName({ displayName }));

    const toggleCamera = React.useCallback(
        (enabled?: boolean) => whenConnectedToRoom(() => toggleCameraEnabled({ enabled })),
        [whenConnectedToRoom],
    );
    const toggleMicrophone = React.useCallback(
        (enabled?: boolean) => whenConnectedToRoom(() => toggleMicrophoneEnabled({ enabled })),
        [whenConnectedToRoom],
    );
    const toggleLowDataMode = React.useCallback(
        (enabled?: boolean) => whenConnectedToRoom(() => toggleLowDataModeEnabled({ enabled })),
        [whenConnectedToRoom],
    );
    const toggleRaiseHand = React.useCallback(
        (enabled?: boolean) => whenConnectedToRoom(() => doSetLocalStickyReaction({ enabled })),
        [whenConnectedToRoom],
    );
    const askToSpeak = React.useCallback(
        (participantId: string) =>
            whenConnectedToRoom(() => doRequestAudioEnable({ clientIds: [participantId], enable: true })),
        [whenConnectedToRoom],
    );
    const acceptWaitingParticipant = React.useCallback(
        (participantId: string) => whenConnectedToRoom(() => doAcceptWaitingParticipant({ participantId })),
        [whenConnectedToRoom],
    );
    const rejectWaitingParticipant = React.useCallback(
        (participantId: string) => whenConnectedToRoom(() => doRejectWaitingParticipant({ participantId })),
        [whenConnectedToRoom],
    );
    const startCloudRecording = React.useCallback(
        () => whenConnectedToRoom(() => doStartCloudRecording()),
        [whenConnectedToRoom],
    );
    const startScreenshare = React.useCallback(
        () => whenConnectedToRoom(() => doStartScreenshare()),
        [whenConnectedToRoom],
    );
    const stopCloudRecording = React.useCallback(
        () => whenConnectedToRoom(() => doStopCloudRecording()),
        [whenConnectedToRoom],
    );
    const stopScreenshare = React.useCallback(
        () => whenConnectedToRoom(() => doStopScreenshare()),
        [whenConnectedToRoom],
    );
    const joinRoom = React.useCallback(() => dispatch(doAppStart(roomConfig)), [dispatch]);
    const leaveRoom = React.useCallback(() => whenConnectedToRoom(() => doAppStop()), [whenConnectedToRoom]);
    const lockRoom = React.useCallback(
        (locked: boolean) => whenConnectedToRoom(() => doLockRoom({ locked })),
        [whenConnectedToRoom],
    );
    const muteParticipants = React.useCallback(
        (participantIds: string[]) =>
            whenConnectedToRoom(() => doRequestAudioEnable({ clientIds: participantIds, enable: false })),
        [whenConnectedToRoom],
    );
    const spotlightParticipant = React.useCallback(
        (participantId: string) => whenConnectedToRoom(() => doSpotlightParticipant({ id: participantId })),
        [whenConnectedToRoom],
    );
    const removeSpotlight = React.useCallback(
        (participantId: string) => whenConnectedToRoom(() => doRemoveSpotlight({ id: participantId })),
        [whenConnectedToRoom],
    );
    const kickParticipant = React.useCallback(
        (participantId: string) => whenConnectedToRoom(() => doKickParticipant({ clientId: participantId })),
        [whenConnectedToRoom],
    );
    const endMeeting = React.useCallback(
        (stayBehind?: boolean) => whenConnectedToRoom(() => doEndMeeting({ stayBehind })),
        [whenConnectedToRoom],
    );

    const { events, ...state } = roomConnectionState;

    return {
        state,
        events,
        actions: {
            toggleLowDataMode,
            toggleRaiseHand,
            askToSpeak,
            acceptWaitingParticipant,
            knock,
            joinRoom,
            leaveRoom,
            lockRoom,
            muteParticipants,
            kickParticipant,
            endMeeting,
            rejectWaitingParticipant,
            sendChatMessage,
            setDisplayName,
            startCloudRecording,
            startScreenshare,
            stopCloudRecording,
            stopScreenshare,
            toggleCamera,
            toggleMicrophone,
            spotlightParticipant,
            removeSpotlight,
        },
    };
}
