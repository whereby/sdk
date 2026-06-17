import { RoomConnectionState } from "@whereby.com/core";

export const initialState: RoomConnectionState = {
    chatMessages: [],
    fileUploads: [],
    cloudRecording: undefined,
    breakout: {
        isActive: false,
        currentGroup: null,
        groups: null,
        enforceAssignment: false,
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
};
