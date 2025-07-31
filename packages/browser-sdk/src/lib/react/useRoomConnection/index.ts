import * as React from "react";
import {
    AppConfig,
    BREAKOUT_CONFIG_CHANGED,
    CHAT_NEW_MESSAGE,
    ClientView,
    CONNECTION_STATUS_CHANGED,
    ConnectionStatus,
    LOCAL_PARTICIPANT_JOINED,
    LOCAL_PARTICIPANT_LEFT,
    NotificationsEventEmitter,
    REMOTE_PARTICIPANT_JOINED,
    REMOTE_PARTICIPANT_LEFT,
    ROOM_JOINED,
    SCREENSHARE_STARTED,
    SCREENSHARE_STOPPED,
    SPOTLIGHT_PARTICIPANT_ADDED,
    SPOTLIGHT_PARTICIPANT_REMOVED,
    STREAMING_STARTED,
    STREAMING_STOPPED,
    WAITING_PARTICIPANT_JOINED,
    WAITING_PARTICIPANT_LEFT,
    ChatMessage,
    Screenshare,
    WaitingParticipant,
    RemoteParticipantState,
    LiveStreamState,
    RoomConnectionState,
    LocalParticipantState,
    REMOTE_PARTICIPANT_CHANGED,
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
    const client = React.useContext(WherebyContext)?.getRoomConnectionClient();
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

    const handleConnectionStatusChange = React.useCallback((status: ConnectionStatus) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            connectionStatus: status,
        }));
    }, []);

    const handleChatMessage = React.useCallback((message: ChatMessage) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            chatMessages: [...prevState.chatMessages, message],
        }));
    }, []);

    const handleLocalParticipantJoined = React.useCallback((participant: LocalParticipantState) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            localParticipant: participant,
        }));
    }, []);

    const handleLocalParticipantLeft = React.useCallback(() => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            localParticipant: undefined,
        }));
    }, []);

    const handleRemoteParticipantChanged = React.useCallback((participant: RemoteParticipantState) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            remoteParticipants: prevState.remoteParticipants.map((p) => (p.id === participant.id ? participant : p)),
        }));
    }, []);

    const handleRemoteParticipantJoined = React.useCallback((participant: RemoteParticipantState) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            remoteParticipants: [...prevState.remoteParticipants, participant],
        }));
    }, []);

    const handleRemoteParticipantLeft = React.useCallback((participantId: string) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            remoteParticipants: prevState.remoteParticipants.filter((p) => p.id !== participantId),
        }));
    }, []);

    const handleScreenshareStarted = React.useCallback((screenshare: Screenshare) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            screenshares: [...prevState.screenshares, screenshare],
        }));
    }, []);

    const handleScreenshareStopped = React.useCallback((screenshareId: string) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            screenshares: prevState.screenshares.filter((s) => s.id !== screenshareId),
        }));
    }, []);

    const handleWaitingParticipantJoined = React.useCallback((participant: WaitingParticipant) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            waitingParticipants: [...prevState.waitingParticipants, participant],
        }));
    }, []);

    const handleWaitingParticipantLeft = React.useCallback((participantId: string) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            waitingParticipants: prevState.waitingParticipants.filter((p) => p.id !== participantId),
        }));
    }, []);

    const handleSpotlightParticipantAdded = React.useCallback((participant: ClientView) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            spotlightedParticipants: [...prevState.spotlightedParticipants, participant],
        }));
    }, []);

    const handleSpotlightParticipantRemoved = React.useCallback((participantId: string) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            spotlightedParticipants: prevState.spotlightedParticipants.filter((p) => p.id !== participantId),
        }));
    }, []);

    const handleBreakoutConfigChanged = React.useCallback((config: RoomConnectionState["breakout"]) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            breakout: {
                ...prevState.breakout,
                isActive: config.isActive,
                currentGroup: config.currentGroup,
                groupedParticipants: config.groupedParticipants,
                participantsInCurrentGroup: config.participantsInCurrentGroup,
            },
        }));
    }, []);

    const handleLiveStreamingStarted = React.useCallback((liveStream: LiveStreamState) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            liveStream: {
                ...prevState.liveStream,
                startedAt: liveStream.startedAt,
                status: "streaming",
            },
        }));
    }, []);

    const handleLiveStreamingStopped = React.useCallback(() => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            liveStream: undefined,
        }));
    }, []);

    const handleEventEmitter = React.useCallback(() => {
        const emitter = client.getNotificationsEventEmitter();
        setRoomConnectionState((prevState) => ({
            ...prevState,
            events: emitter,
        }));
    }, [client]);

    const handleRemoteParticipantsChanged = React.useCallback((participants: RemoteParticipantState[]) => {
        setRoomConnectionState((prevState) => ({
            ...prevState,
            remoteParticipants: participants,
        }));
    }, []);

    React.useEffect(() => {
        const unsubscribe = client.subscribeToParticipants(handleRemoteParticipantsChanged);
        return () => unsubscribe();
    }, [client, handleRemoteParticipantsChanged]);

    React.useEffect(() => {
        client.initialize(roomConfig);

        client.on(ROOM_JOINED, handleEventEmitter);
        client.on(CONNECTION_STATUS_CHANGED, handleConnectionStatusChange);
        client.on(CHAT_NEW_MESSAGE, handleChatMessage);
        client.on(LOCAL_PARTICIPANT_JOINED, handleLocalParticipantJoined);
        client.on(LOCAL_PARTICIPANT_LEFT, handleLocalParticipantLeft);
        // client.on(REMOTE_PARTICIPANT_JOINED, handleRemoteParticipantJoined);
        // client.on(REMOTE_PARTICIPANT_LEFT, handleRemoteParticipantLeft);
        // client.on(REMOTE_PARTICIPANT_CHANGED, handleRemoteParticipantChanged);
        client.on(SCREENSHARE_STARTED, handleScreenshareStarted);
        client.on(SCREENSHARE_STOPPED, handleScreenshareStopped);
        client.on(WAITING_PARTICIPANT_JOINED, handleWaitingParticipantJoined);
        client.on(WAITING_PARTICIPANT_LEFT, handleWaitingParticipantLeft);
        client.on(SPOTLIGHT_PARTICIPANT_ADDED, handleSpotlightParticipantAdded);
        client.on(SPOTLIGHT_PARTICIPANT_REMOVED, handleSpotlightParticipantRemoved);
        client.on(BREAKOUT_CONFIG_CHANGED, handleBreakoutConfigChanged);
        client.on(STREAMING_STARTED, handleLiveStreamingStarted);
        client.on(STREAMING_STOPPED, handleLiveStreamingStopped);

        return () => {
            client.destroy();
        };
    }, [client]);

    const joinRoom = React.useCallback(() => client.joinRoom(), [client]);
    const sendChatMessage = React.useCallback((text: string) => client.sendChatMessage(text), [client]);
    const knock = React.useCallback(() => client.knock(), [client]);
    const setDisplayName = React.useCallback((displayName: string) => client.setDisplayName(displayName), [client]);
    const toggleCamera = React.useCallback((enabled?: boolean) => client.toggleCamera(enabled), [client]);
    const toggleMicrophone = React.useCallback((enabled?: boolean) => client.toggleMicrophone(enabled), [client]);
    const toggleLowDataMode = React.useCallback((enabled?: boolean) => client.toggleLowDataMode(enabled), [client]);
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
    const startScreenshare = React.useCallback(() => client.startScreenshare(), [client]);
    const stopCloudRecording = React.useCallback(() => client.stopCloudRecording(), [client]);
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

    const { events, ...state } = roomConnectionState;

    return {
        state,
        events,
        actions: {
            toggleLowDataMode,
            toggleRaiseHand,
            askToSpeak,
            askToTurnOnCamera,
            acceptWaitingParticipant,
            knock,
            joinRoom,
            leaveRoom,
            lockRoom,
            muteParticipants,
            turnOffParticipantCameras,
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
            joinBreakoutGroup,
            joinBreakoutMainRoom,
        },
    };
}
