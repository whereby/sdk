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
} from "@whereby.com/core";

import { selectRoomConnectionState } from "./selector";
import { RoomConnectionState, RoomConnectionActions, UseRoomConnectionOptions } from "./types";
import { browserSdkVersion } from "../version";
import { useAppDispatch, useAppSelector } from "../Provider/hooks";

export type RoomConnectionRef = {
    state: RoomConnectionState;
    actions: RoomConnectionActions;
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

    const sendChatMessage = React.useCallback((text: string) => dispatch(doSendChatMessage({ text })), [dispatch]);
    const knock = React.useCallback(() => dispatch(doKnockRoom()), [dispatch]);
    const setDisplayName = React.useCallback(
        (displayName: string) => dispatch(doSetDisplayName({ displayName })),
        [dispatch],
    );
    const toggleCamera = React.useCallback(
        (enabled?: boolean) => dispatch(toggleCameraEnabled({ enabled })),
        [dispatch],
    );
    const toggleMicrophone = React.useCallback(
        (enabled?: boolean) => dispatch(toggleMicrophoneEnabled({ enabled })),
        [dispatch],
    );
    const toggleLowDataMode = React.useCallback(
        (enabled?: boolean) => dispatch(toggleLowDataModeEnabled({ enabled })),
        [dispatch],
    );
    const acceptWaitingParticipant = React.useCallback(
        (participantId: string) => dispatch(doAcceptWaitingParticipant({ participantId })),
        [dispatch],
    );
    const rejectWaitingParticipant = React.useCallback(
        (participantId: string) => dispatch(doRejectWaitingParticipant({ participantId })),
        [dispatch],
    );
    const startCloudRecording = React.useCallback(() => dispatch(doStartCloudRecording()), [dispatch]);
    const startScreenshare = React.useCallback(() => dispatch(doStartScreenshare()), [dispatch]);
    const stopCloudRecording = React.useCallback(() => dispatch(doStopCloudRecording()), [dispatch]);
    const stopScreenshare = React.useCallback(() => dispatch(doStopScreenshare()), [dispatch]);
    const joinRoom = React.useCallback(() => dispatch(doAppStart(roomConfig)), [dispatch]);
    const leaveRoom = React.useCallback(() => dispatch(doAppStop()), [dispatch]);
    const lockRoom = React.useCallback((locked: boolean) => dispatch(doLockRoom({ locked })), [dispatch]);
    const muteParticipants = React.useCallback(
        (participantIds: string[]) => {
            dispatch(doRequestAudioEnable({ clientIds: participantIds, enable: false }));
        },
        [dispatch],
    );
    const spotlightParticipant = React.useCallback(
        (participantId: string) => dispatch(doSpotlightParticipant({ id: participantId })),
        [dispatch],
    );
    const removeSpotlight = React.useCallback(
        (participantId: string) => dispatch(doRemoveSpotlight({ id: participantId })),
        [dispatch],
    );
    const kickParticipant = React.useCallback(
        (participantId: string) => dispatch(doKickParticipant({ clientId: participantId })),
        [dispatch],
    );
    const endMeeting = React.useCallback((stayBehind?: boolean) => dispatch(doEndMeeting({ stayBehind })), [dispatch]);

    return {
        state: roomConnectionState,
        actions: {
            toggleLowDataMode,
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
