import * as React from "react";
import {
    AppConfig,
    ChatFileShare,
    NotificationsEventEmitter,
    RoomConnectionState,
    StartBreakoutSessionOptions,
    UpdateBreakoutSessionOptions,
} from "@whereby.com/core";

import { RoomConnectionActions, UseRoomConnectionOptions } from "./types";
import { browserSdkVersion } from "../version";
import { WherebyContext } from "../Provider";
import { initialState } from "./initialState";

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
    const client = React.useContext(WherebyContext)?.getRoomConnection();
    const [roomConnectionState, setRoomConnectionState] = React.useState<RoomConnectionState>(() => initialState);

    if (!client) {
        throw new Error("WherebyClient is not initialized. Please wrap your component with WherebyProvider.");
    }

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
        const unsubscribe = client.subscribe((state) => {
            setRoomConnectionState((prev) => ({
                ...prev,
                ...state,
            }));
        });
        const eventEmitter = client.getNotificationsEventEmitter();
        setRoomConnectionState((prev) => ({
            ...prev,
            events: eventEmitter,
        }));

        return () => {
            unsubscribe();
            client.leaveRoom();
        };
    }, []);

    const joinRoom = React.useCallback(() => {
        client.initialize(roomConfig);
        return client.joinRoom();
    }, [client]);
    const sendChatMessage = React.useCallback(
        (text: string, parentId?: string, isBroadcast?: boolean) =>
            client.sendChatMessage(text, parentId, isBroadcast),
        [client],
    );
    const removeChatMessage = React.useCallback(
        (id: string, sig?: string | null) => client.removeChatMessage(id, sig),
        [client],
    );
    const sendFiles = React.useCallback((files: File[]) => client.sendFiles(files), [client]);
    const downloadFile = React.useCallback((file: ChatFileShare) => client.downloadFile(file), [client]);
    const knock = React.useCallback(() => client.knock(), [client]);
    const cancelKnock = React.useCallback(() => client.cancelKnock(), [client]);
    const setDisplayName = React.useCallback((displayName: string) => client.setDisplayName(displayName), [client]);
    const toggleCamera = React.useCallback((enabled?: boolean) => client.toggleCamera(enabled), [client]);
    const toggleMicrophone = React.useCallback((enabled?: boolean) => client.toggleMicrophone(enabled), [client]);
    const toggleHdMode = React.useCallback((enabled?: boolean) => client.toggleHdMode(enabled), [client]);
    const toggleLowDataMode = React.useCallback((enabled?: boolean) => client.toggleLowDataMode(enabled), [client]);
    const toggleWidescreenMode = React.useCallback(
        (enabled?: boolean) => client.toggleWidescreenMode(enabled),
        [client],
    );
    const toggleRaiseHand = React.useCallback((enabled?: boolean) => client.toggleRaiseHand(enabled), [client]);
    const askToSpeak = React.useCallback((participantId: string) => client.askToSpeak(participantId), [client]);
    const askToTurnOnCamera = React.useCallback(
        (participantId: string) => client.askToTurnOnCamera(participantId),
        [client],
    );
    const acceptWaitingParticipant = React.useCallback(
        (participantId: string) => client.acceptWaitingParticipant(participantId),
        [client],
    );
    const rejectWaitingParticipant = React.useCallback(
        (participantId: string) => client.rejectWaitingParticipant(participantId),
        [client],
    );
    const startCloudRecording = React.useCallback(() => client.startCloudRecording(), [client]);
    const startLiveTranscription = React.useCallback(() => client.startLiveTranscription(), [client]);
    const startScreenshare = React.useCallback(() => client.startScreenshare(), [client]);
    const stopCloudRecording = React.useCallback(() => client.stopCloudRecording(), [client]);
    const stopLiveTranscription = React.useCallback(() => client.stopLiveTranscription(), [client]);
    const stopScreenshare = React.useCallback(() => client.stopScreenshare(), [client]);
    const leaveRoom = React.useCallback(() => client.leaveRoom(), [client]);
    const lockRoom = React.useCallback((locked: boolean) => client.lockRoom(locked), [client]);
    const muteParticipants = React.useCallback(
        (participantIds: string[]) => client.muteParticipants(participantIds),
        [client],
    );
    const turnOffParticipantCameras = React.useCallback(
        (participantIds: string[]) => client.turnOffParticipantCameras(participantIds),
        [client],
    );
    const spotlightParticipant = React.useCallback(
        (participantId: string) => client.spotlightParticipant(participantId),
        [client],
    );
    const removeSpotlight = React.useCallback(
        (participantId: string) => client.removeSpotlight(participantId),
        [client],
    );
    const kickParticipant = React.useCallback(
        (participantId: string) => client.kickParticipant(participantId),
        [client],
    );
    const endMeeting = React.useCallback((stayBehind?: boolean) => client.endMeeting(stayBehind), [client]);
    const joinBreakoutGroup = React.useCallback((group: string) => client.joinBreakoutGroup(group), [client]);
    const joinBreakoutMainRoom = React.useCallback(() => client.joinBreakoutMainRoom(), [client]);
    const startBreakoutSession = React.useCallback(
        (options: StartBreakoutSessionOptions) => client.startBreakoutSession(options),
        [client],
    );
    const updateBreakoutSession = React.useCallback(
        (options: UpdateBreakoutSessionOptions) => client.updateBreakoutSession(options),
        [client],
    );
    const stopBreakoutSession = React.useCallback(() => client.stopBreakoutSession(), [client]);
    const assignBreakoutParticipants = React.useCallback(
        (assignments: { [clientId: string]: string }) => client.assignBreakoutParticipants(assignments),
        [client],
    );
    const assignAllBreakoutParticipants = React.useCallback(
        () => client.assignAllBreakoutParticipants(),
        [client],
    );
    const unassignAllBreakoutParticipants = React.useCallback(
        () => client.unassignAllBreakoutParticipants(),
        [client],
    );
    const shuffleBreakoutParticipants = React.useCallback(() => client.shuffleBreakoutParticipants(), [client]);
    const extendBreakoutTimer = React.useCallback((seconds?: number) => client.extendBreakoutTimer(seconds), [client]);
    const stopBreakoutTimer = React.useCallback(() => client.stopBreakoutTimer(), [client]);
    const broadcastToGroups = React.useCallback(
        (participantId: string) => client.broadcastToGroups(participantId),
        [client],
    );
    const stopBroadcastToGroups = React.useCallback(
        (participantId: string) => client.stopBroadcastToGroups(participantId),
        [client],
    );
    const switchCameraEffect = React.useCallback(
        async (effectId: string) => {
            await client.switchCameraEffect(effectId);
        },
        [client],
    );
    const switchCameraEffectCustom = React.useCallback(
        async (imageUrl: string) => {
            await client.switchCameraEffectCustom(imageUrl);
        },
        [client],
    );
    const clearCameraEffect = React.useCallback(async () => {
        await client.clearCameraEffect();
    }, [client]);
    const enableAudioDenoiser = React.useCallback(async () => {
        await client.enableAudioDenoiser();
    }, [client]);
    const disableAudioDenoiser = React.useCallback(async () => {
        await client.disableAudioDenoiser();
    }, [client]);

    const { events, ...state } = roomConnectionState;

    return {
        state,
        events,
        actions: {
            askToSpeak,
            askToTurnOnCamera,
            acceptWaitingParticipant,
            knock,
            cancelKnock,
            joinRoom,
            leaveRoom,
            lockRoom,
            muteParticipants,
            turnOffParticipantCameras,
            kickParticipant,
            endMeeting,
            rejectWaitingParticipant,
            sendChatMessage,
            removeChatMessage,
            sendFiles,
            downloadFile,
            setDisplayName,
            startCloudRecording,
            startLiveTranscription,
            startScreenshare,
            stopCloudRecording,
            stopLiveTranscription,
            stopScreenshare,
            toggleCamera,
            toggleMicrophone,
            toggleRaiseHand,
            toggleHdMode,
            toggleLowDataMode,
            toggleWidescreenMode,
            spotlightParticipant,
            removeSpotlight,
            joinBreakoutGroup,
            joinBreakoutMainRoom,
            startBreakoutSession,
            updateBreakoutSession,
            stopBreakoutSession,
            assignBreakoutParticipants,
            assignAllBreakoutParticipants,
            unassignAllBreakoutParticipants,
            shuffleBreakoutParticipants,
            extendBreakoutTimer,
            stopBreakoutTimer,
            broadcastToGroups,
            stopBroadcastToGroups,
            switchCameraEffect,
            switchCameraEffectCustom,
            clearCameraEffect,
            enableAudioDenoiser,
            disableAudioDenoiser,
        },
    };
}
