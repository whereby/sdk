import * as React from "react";
import {
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
    appLeft,
    doAppJoin,
    doKnockRoom,
    doLockRoom,
    doKickParticipant,
    doEndMeeting,
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

    React.useEffect(() => {
        const url = new URL(roomUrl); // Throw if invalid Whereby room url
        const searchParams = new URLSearchParams(url.search);
        const roomKey = roomConnectionOptions.roomKey || searchParams.get("roomKey");

        dispatch(
            doAppJoin({
                displayName: roomConnectionOptions.displayName || "Guest",
                localMediaOptions: roomConnectionOptions.localMedia
                    ? undefined
                    : roomConnectionOptions.localMediaOptions,
                roomKey,
                roomUrl,
                userAgent: `browser-sdk:${browserSdkVersion}`,
                externalId: roomConnectionOptions.externalId || null,
            }),
        );
        return () => {
            dispatch(appLeft());
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

    const lockRoom = React.useCallback((locked: boolean) => dispatch(doLockRoom({ locked })), [dispatch]);
    const muteParticipants = React.useCallback(
        (clientIds: string[]) => {
            dispatch(doRequestAudioEnable({ clientIds, enable: false }));
        },
        [dispatch],
    );
    const kickParticipant = React.useCallback(
        (clientId: string) => dispatch(doKickParticipant({ clientId })),
        [dispatch],
    );
    const endMeeting = React.useCallback(() => dispatch(doEndMeeting()), [dispatch]);

    return {
        state: roomConnectionState,
        actions: {
            toggleLowDataMode,
            acceptWaitingParticipant,
            knock,
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
        },
    };
}
