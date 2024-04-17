import * as React from "react";
import {
    Store,
    createStore,
    observeStore,
    createServices,
    doSendChatMessage,
    doStartCloudRecording,
    doStopCloudRecording,
    doAcceptWaitingParticipant,
    doRejectWaitingParticipant,
    doRequestAudioEnable,
    doSetDisplayName,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
    doStartScreenshare,
    doStopScreenshare,
    appLeft,
    doAppJoin,
    doKnockRoom,
    doLockRoom,
    doKickParticipant,
    doRtcReportStreamResolution,
} from "@whereby.com/core";

import VideoView from "../VideoView";
import { selectRoomConnectionState } from "./selector";
import { RoomConnectionState, RoomConnectionActions, UseRoomConnectionOptions } from "./types";
import { browserSdkVersion } from "../version";

const initialState: RoomConnectionState = {
    chatMessages: [],
    remoteParticipants: [],
    connectionStatus: "initializing",
    screenshares: [],
    waitingParticipants: [],
};

type VideoViewComponentProps = Omit<React.ComponentProps<typeof VideoView>, "onResize">;

interface RoomConnectionComponents {
    VideoView: (props: VideoViewComponentProps) => ReturnType<typeof VideoView>;
}

export type RoomConnectionRef = {
    state: RoomConnectionState;
    actions: RoomConnectionActions;
    components: RoomConnectionComponents;
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
    const [store] = React.useState<Store>(() => {
        if (roomConnectionOptions.localMedia) {
            return roomConnectionOptions.localMedia.store;
        }
        const services = createServices();
        return createStore({ injectServices: services });
    });
    const [boundVideoView, setBoundVideoView] = React.useState<(props: VideoViewComponentProps) => JSX.Element>();
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

    React.useEffect(() => {
        if (store && !boundVideoView) {
            setBoundVideoView(() => (props: VideoViewComponentProps): JSX.Element => {
                return React.createElement(
                    VideoView as React.ComponentType<VideoViewComponentProps>,
                    Object.assign({}, props, {
                        onResize: ({
                            stream,
                            width,
                            height,
                        }: {
                            stream: MediaStream;
                            width: number;
                            height: number;
                        }) => {
                            store.dispatch(
                                doRtcReportStreamResolution({
                                    streamId: stream.id,
                                    width,
                                    height,
                                }),
                            );
                        },
                    }),
                );
            });
        }
    }, [store, boundVideoView]);

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

    return {
        state: roomConnectionState,
        actions: {
            acceptWaitingParticipant,
            knock,
            lockRoom,
            muteParticipants,
            kickParticipant,
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
        components: {
            VideoView: boundVideoView || VideoView,
        },
        _ref: store,
    };
}
