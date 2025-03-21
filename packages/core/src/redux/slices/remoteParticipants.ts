import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { SignalClient, RtcStreamAddedPayload, AudioEnableRequest, VideoEnableRequest } from "@whereby.com/media";
import { RemoteParticipant, StreamState } from "../../RoomParticipant";
import { rtcEvents } from "./rtcConnection/actions";
import { StreamStatusUpdate } from "./rtcConnection/types";
import { signalEvents } from "./signalConnection/actions";
import { createAuthorizedRoomConnectedThunk } from "../thunk";
import {
    selectIsAuthorizedToAskToSpeak,
    selectIsAuthorizedToRequestAudioEnable,
    selectIsAuthorizedToRequestVideoEnable,
} from "./authorization";
import { selectSignalConnectionRaw } from "./signalConnection";
import { NON_PERSON_ROLES } from "../constants";
import { selectLocalParticipantRaw } from "./localParticipant/selectors";

/**
 * State mapping utils
 */

export function createRemoteParticipant(client: SignalClient, newJoiner = false): RemoteParticipant {
    const { streams, role, breakoutGroup, ...rest } = client;

    return {
        ...rest,
        stream: null,
        streams: streams.map((streamId) => ({ id: streamId, state: newJoiner ? "new_accept" : "to_accept" })),
        isLocalParticipant: false,
        roleName: role?.roleName || "none",
        presentationStream: null,
        breakoutGroup: breakoutGroup || null,
        newJoiner,
    };
}

// function isCaptionerClient(client: SignalClient) {
//     return client.roleName === "captioner" || client.role?.roleName === "captioner";
// }

function findParticipant(state: RemoteParticipantState, participantId: string) {
    const index = state.remoteParticipants.findIndex((c) => c.id === participantId);
    return { index, participant: state.remoteParticipants[index] };
}

function updateParticipant(state: RemoteParticipantState, participantId: string, updates: Partial<RemoteParticipant>) {
    const { participant, index } = findParticipant(state, participantId);

    if (!participant) {
        console.error(`Did not find client for update ${participantId}`);
        return state;
    }

    return {
        ...state,
        remoteParticipants: [
            ...state.remoteParticipants.slice(0, index),
            { ...participant, ...updates },
            ...state.remoteParticipants.slice(index + 1),
        ],
    };
}

function addParticipant(state: RemoteParticipantState, participant: RemoteParticipant) {
    const { participant: foundParticipant } = findParticipant(state, participant.id);

    if (foundParticipant) {
        console.warn(`Client already existing ${participant.id}. Ignoring`);
        return state;
    }

    return {
        ...state,
        remoteParticipants: [...state.remoteParticipants, participant],
    };
}

function updateStreamState(
    state: RemoteParticipantState,
    participantId: string,
    streamId: string,
    state_: StreamState,
) {
    const { participant } = findParticipant(state, participantId);
    if (!participant) {
        console.error(`No client ${participantId} found to update stream ${streamId} ${state_}`);
        return state;
    }

    const idIdx = participant.streams.findIndex((s) => s.id === streamId);
    const streams = [...participant.streams];
    streams[idIdx] = { ...streams[idIdx], state: state_ };

    return updateParticipant(state, participantId, { streams });
}

function removeClient(state: RemoteParticipantState, participantId: string) {
    return {
        ...state,
        remoteParticipants: state.remoteParticipants.filter((c) => c.id !== participantId),
    };
}

function addStreamId(state: RemoteParticipantState, participantId: string, streamId: string) {
    const { participant } = findParticipant(state, participantId);

    if (!participant || participant.streams.find((s) => s.id === streamId)) {
        console.warn(`No participant ${participantId} or stream ${streamId} already exists`);
        return state;
    }

    return updateParticipant(state, participantId, {
        streams: [...participant.streams, { id: streamId, state: "to_accept" }],
    });
}

function removeStreamId(state: RemoteParticipantState, participantId: string, streamId: string) {
    const { participant } = findParticipant(state, participantId);
    if (!participant) {
        console.error(`No participant ${participantId} found to remove stream ${streamId}`);
        return state;
    }
    const currentStreamId = participant.stream && participant.stream.id;
    const presentationId = participant.presentationStream?.inboundId || participant.presentationStream?.id;
    const idIdx = participant.streams.findIndex((s) => s.id === streamId);

    return updateParticipant(state, participantId, {
        streams: participant.streams.filter((_, i) => i !== idIdx),
        ...(currentStreamId === streamId && { stream: null }),
        ...(presentationId === streamId && { presentationStream: null }),
    });
}

function addStream(state: RemoteParticipantState, payload: RtcStreamAddedPayload) {
    const { clientId, stream, streamType } = payload;
    let { streamId } = payload;

    const { participant } = findParticipant(state, clientId);

    if (!participant) {
        console.error(`Did not find client ${clientId} for adding stream`);
        return state;
    }

    const remoteParticipants = state.remoteParticipants;

    if (!streamId) {
        streamId = stream.id;
    }

    const remoteParticipant = remoteParticipants.find((p) => p.id === clientId);

    if (!remoteParticipant) {
        return state;
    }

    const remoteParticipantStream = remoteParticipant.streams.find((s) => s.id === streamId);

    if (
        (remoteParticipant.stream &&
            (remoteParticipant.stream.id === streamId || remoteParticipant.stream.inboundId === streamId)) ||
        (!remoteParticipant.stream && streamType === "webcam") ||
        (!remoteParticipant.stream && !streamType && !remoteParticipantStream)
    ) {
        return updateParticipant(state, clientId, { stream });
    }
    // screen share
    return updateParticipant(state, clientId, {
        presentationStream: stream,
    });
}

/**
 * Reducer
 */

export interface RemoteParticipantState {
    remoteParticipants: RemoteParticipant[];
}

export const remoteParticipantsSliceInitialState: RemoteParticipantState = {
    remoteParticipants: [],
};

export const remoteParticipantsSlice = createSlice({
    name: "remoteParticipants",
    initialState: remoteParticipantsSliceInitialState,
    reducers: {
        streamStatusUpdated: (state, action: PayloadAction<StreamStatusUpdate[]>) => {
            let newState = state;

            for (const { clientId, streamId, state } of action.payload) {
                newState = updateStreamState(newState, clientId, streamId, state);
            }

            return newState;
        },
        participantStreamAdded: (state, action: PayloadAction<RtcStreamAddedPayload>) => {
            const { clientId, stream } = action.payload;

            return updateParticipant(state, clientId, {
                stream,
            });
        },
        participantStreamIdAdded: (state, action: PayloadAction<{ clientId: string; streamId: string }>) => {
            const { clientId, streamId } = action.payload;

            return addStreamId(state, clientId, streamId);
        },
    },
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const { error, room, selfId } = action.payload || {};

            if (error) {
                return state;
            }

            if (room?.clients) {
                return {
                    ...state,
                    remoteParticipants: room.clients
                        .filter((c) => c.id !== selfId)
                        .map((c) => createRemoteParticipant(c)),
                };
            }

            return state;
        });
        builder.addCase(rtcEvents.streamAdded, (state, action) => {
            return addStream(state, action.payload);
        });
        builder.addCase(signalEvents.newClient, (state, action) => {
            const { client } = action.payload;

            return addParticipant(state, createRemoteParticipant(client, true));
        });
        builder.addCase(signalEvents.clientLeft, (state, action) => {
            const { clientId } = action.payload;

            return removeClient(state, clientId);
        });
        builder.addCase(signalEvents.audioEnabled, (state, action) => {
            const { clientId, isAudioEnabled } = action.payload;

            return updateParticipant(state, clientId, {
                isAudioEnabled,
            });
        });
        builder.addCase(signalEvents.videoEnabled, (state, action) => {
            const { clientId, isVideoEnabled } = action.payload;

            return updateParticipant(state, clientId, {
                isVideoEnabled,
            });
        });
        builder.addCase(signalEvents.clientMetadataReceived, (state, action) => {
            const { error, payload } = action.payload;

            if (error || !payload) {
                console.warn(error || "Client metadata error received");
                return state;
            }

            const { clientId, displayName, stickyReaction } = payload;

            return updateParticipant(state, clientId, {
                displayName,
                stickyReaction,
            });
        });
        builder.addCase(signalEvents.breakoutGroupJoined, (state, action) => {
            const { clientId, group } = action.payload;

            return updateParticipant(state, clientId, {
                breakoutGroup: group || null,
            });
        });
        builder.addCase(signalEvents.screenshareStarted, (state, action) => {
            const { clientId, streamId } = action.payload;

            return addStreamId(state, clientId, streamId);
        });
        builder.addCase(signalEvents.screenshareStopped, (state, action) => {
            const { clientId, streamId } = action.payload;

            return removeStreamId(state, clientId, streamId);
        });
    },
});

/**
 * Action creators
 */

export const { participantStreamAdded, participantStreamIdAdded, streamStatusUpdated } =
    remoteParticipantsSlice.actions;

export const doRequestAudioEnable = createAuthorizedRoomConnectedThunk(
    (state) => selectIsAuthorizedToRequestAudioEnable(state),
    (payload: AudioEnableRequest) => (_, getState) => {
        const state = getState();
        const canEnableRemoteAudio = selectIsAuthorizedToAskToSpeak(state);

        if (payload.enable && !canEnableRemoteAudio) {
            console.warn("Not authorized to perform this action");
            return;
        }

        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("request_audio_enable", payload);
    },
);

export const doRequestVideoEnable = createAuthorizedRoomConnectedThunk(
    (state) => selectIsAuthorizedToRequestVideoEnable(state),
    (payload: VideoEnableRequest) => (_, getState) => {
        const state = getState();

        const socket = selectSignalConnectionRaw(state).socket;

        socket?.emit("request_video_enable", payload);
    },
);

/**
 * Selectors
 */

export const selectRemoteParticipantsRaw = (state: RootState) => state.remoteParticipants;

/**
 * This includes non human roles such as recorder.
 */
export const selectRemoteClients = (state: RootState) => state.remoteParticipants.remoteParticipants;

export const selectRemoteParticipants = createSelector(selectRemoteClients, (clients) =>
    clients.filter((c) => !NON_PERSON_ROLES.includes(c.roleName)),
);
export const selectNumClients = createSelector(selectRemoteClients, (clients) => clients.length + 1);
export const selectNumParticipants = createSelector(
    selectRemoteParticipants,
    selectLocalParticipantRaw,
    (clients, localParticipant) => {
        if (NON_PERSON_ROLES.includes(localParticipant.roleName)) {
            return clients.length;
        }
        return clients.length + 1;
    },
);
