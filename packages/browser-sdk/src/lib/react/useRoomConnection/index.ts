import * as React from "react";
import {
    Store,
    observeStore,
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
import { WherebyContext } from "../Provider";

const initialState: RoomConnectionState = {
    chatMessages: [],
    remoteParticipants: [],
    connectionStatus: "initializing",
    screenshares: [],
    waitingParticipants: [],
};

export type RoomConnectionRef = {
    state: RoomConnectionState;
    actions: RoomConnectionActions;
    _ref: Store;
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
    const store = React.useContext(WherebyContext);

    if (!store) {
        throw new Error("useRoomConnection must be used within a WherebyProvider");
    }

    const [roomConnectionState, setRoomConnectionState] = React.useState(initialState);

    React.useEffect(() => {
        const unsubscribe = observeStore(store, selectRoomConnectionState, setRoomConnectionState);
        const url = new URL(roomUrl); // Throw if invalid Whereby room url
        const searchParams = new URLSearchParams(url.search);
        const roomKey = roomConnectionOptions.roomKey || searchParams.get("roomKey");

        store.dispatch(
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
            unsubscribe();
            store.dispatch(appLeft());
        };
    }, []);

    const sendChatMessage = React.useCallback((text: string) => store.dispatch(doSendChatMessage({ text })), [store]);
    const knock = React.useCallback(() => store.dispatch(doKnockRoom()), [store]);
    const setDisplayName = React.useCallback(
        (displayName: string) => store.dispatch(doSetDisplayName({ displayName })),
        [store],
    );
    const toggleCamera = React.useCallback(
        (enabled?: boolean) => store.dispatch(toggleCameraEnabled({ enabled })),
        [store],
    );
    const toggleMicrophone = React.useCallback(
        (enabled?: boolean) => store.dispatch(toggleMicrophoneEnabled({ enabled })),
        [store],
    );
    const toggleLowDataMode = React.useCallback(
        (enabled?: boolean) => store.dispatch(toggleLowDataModeEnabled({ enabled })),
        [store],
    );
    const acceptWaitingParticipant = React.useCallback(
        (participantId: string) => store.dispatch(doAcceptWaitingParticipant({ participantId })),
        [store],
    );
    const rejectWaitingParticipant = React.useCallback(
        (participantId: string) => store.dispatch(doRejectWaitingParticipant({ participantId })),
        [store],
    );
    const startCloudRecording = React.useCallback(() => store.dispatch(doStartCloudRecording()), [store]);
    const startScreenshare = React.useCallback(() => store.dispatch(doStartScreenshare()), [store]);
    const stopCloudRecording = React.useCallback(() => store.dispatch(doStopCloudRecording()), [store]);
    const stopScreenshare = React.useCallback(() => store.dispatch(doStopScreenshare()), [store]);

    const lockRoom = React.useCallback((locked: boolean) => store.dispatch(doLockRoom({ locked })), [store]);
    const muteParticipants = React.useCallback(
        (clientIds: string[]) => {
            store.dispatch(doRequestAudioEnable({ clientIds, enable: false }));
        },
        [store],
    );
    const kickParticipant = React.useCallback(
        (clientId: string) => store.dispatch(doKickParticipant({ clientId })),
        [store],
    );
    const endMeeting = React.useCallback(() => store.dispatch(doEndMeeting()), [store]);

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
        _ref: store,
    };
}
