import { RoomConnectionState } from "@whereby.com/core";

export const initialState: RoomConnectionState = {
    chatMessages: [],
    cloudRecording: undefined,
    breakout: {
        isActive: false,
        currentGroup: null,
        groupedParticipants: [],
        participantsInCurrentGroup: [],
    },
    isCameraEnabled: false,
    isMicrophoneEnabled: false,
    localParticipant: undefined,
    remoteParticipants: [],
    screenshares: [],
    connectionStatus: "ready",
    connectionError: null,
    waitingParticipants: [],
    spotlightedParticipants: [],
    roomSessionId: null,
};
