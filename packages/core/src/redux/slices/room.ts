import { createSelector, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { createAppAuthorizedThunk } from "../thunk";
import { signalEvents } from "./signalConnection/actions";
import { doAppStop } from "./app";
import {
    selectIsAuthorizedToLockRoom,
    selectIsAuthorizedToKickClient,
    selectIsAuthorizedToEndMeeting,
} from "./authorization";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectRemoteClients, selectRemoteParticipants } from "./remoteParticipants";
import { selectLocalScreenshareStream } from "./localScreenshare";
import { Screenshare, RemoteParticipant } from "../../RoomParticipant";
import { selectLocalParticipantView, selectLocalParticipantRaw } from "./localParticipant/selectors";
import { ClientView } from "../types";
import { selectBreakoutActive, selectBreakoutAssignments, selectBreakoutCurrentId } from "./breakout";

function isStreamerClient(client: RemoteParticipant) {
    return client.roleName === "streamer";
}

function isRecorderClient(client: RemoteParticipant) {
    return client.roleName === "recorder";
}

/**
 * Reducer
 */

export interface RoomState {
    isLocked: boolean;
}

const initialState: RoomState = {
    isLocked: false,
};

export const roomSlice = createSlice({
    name: "room",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(signalEvents.roomJoined, (state, action) => {
            const { error, isLocked } = action.payload;

            if (error) {
                return state;
            }

            return {
                ...state,
                isLocked: Boolean(isLocked),
            };
        });

        builder.addCase(signalEvents.roomLocked, (state, action) => {
            const { isLocked } = action.payload;

            return {
                ...state,
                isLocked: Boolean(isLocked),
            };
        });
    },
});

/**
 * Action creators
 */

export const doLockRoom = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToLockRoom(state),
    (payload: { locked: boolean }) => (_, getState) => {
        const state = getState();

        const { socket } = selectSignalConnectionRaw(state);
        socket?.emit("set_lock", { locked: payload.locked });
    },
);

export const doKickParticipant = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToKickClient(state),
    (payload: { clientId: string }) => (_, getState) => {
        const state = getState();

        const { socket } = selectSignalConnectionRaw(state);
        socket?.emit("kick_client", { clientId: payload.clientId, reasonId: "kick" });
    },
);

export const doEndMeeting = createAppAuthorizedThunk(
    (state) => selectIsAuthorizedToEndMeeting(state),
    (payload: { stayBehind?: boolean }) => (dispatch, getState) => {
        const state = getState();

        const clientsToKick = selectRemoteClients(state).map((c) => c.id);

        if (clientsToKick.length) {
            const { socket } = selectSignalConnectionRaw(state);

            socket?.emit("kick_client", { clientIds: clientsToKick, reasonId: "end-meeting" });
        }

        if (!payload.stayBehind) {
            dispatch(doAppStop());
        }
    },
);

/**
 * Selectors
 */

export const selectRoomIsLocked = (state: RootState) => state.room.isLocked;

export const selectScreenshares = createSelector(
    selectLocalScreenshareStream,
    selectLocalParticipantRaw,
    selectRemoteParticipants,
    (localScreenshareStream, localParticipant, remoteParticipants) => {
        const screenshares: Screenshare[] = [];

        if (localScreenshareStream) {
            screenshares.push({
                id: localScreenshareStream.id || "local-screenshare",
                participantId: "local",
                hasAudioTrack: localScreenshareStream.getTracks().some((track) => track.kind === "audio"),
                breakoutGroup: localParticipant.breakoutGroup,
                stream: localScreenshareStream,
                isLocal: true,
            });
        }

        for (const participant of remoteParticipants) {
            if (participant.presentationStream) {
                screenshares.push({
                    id: participant.presentationStream.id || `pres-${participant.id}`,
                    participantId: participant.id,
                    hasAudioTrack: participant.presentationStream.getTracks().some((track) => track.kind === "audio"),
                    breakoutGroup: participant.breakoutGroup,
                    stream: participant.presentationStream,
                    isLocal: false,
                });
            }
        }

        return screenshares;
    },
);

export const selectRemoteClientViews = createSelector(
    selectLocalScreenshareStream,
    selectLocalParticipantRaw,
    selectRemoteParticipants,
    selectBreakoutCurrentId,
    selectBreakoutAssignments,
    (localScreenshareStream, localParticipant, remoteParticipants, breakoutCurrentId, breakoutAssignments) => {
        const views: ClientView[] = [];

        if (localScreenshareStream) {
            const isScreenshareAudioEnabled = !!localScreenshareStream.getAudioTracks().length;

            views.push({
                clientId: localParticipant.id,
                displayName: "Your screenshare",
                id: "local-screenshare",
                isAudioEnabled: isScreenshareAudioEnabled,
                isLocalClient: true,
                isPresentation: true,
                isVideoEnabled: true,
                stream: localScreenshareStream,
                breakoutGroup: breakoutCurrentId || "",
            });
        }
        for (const c of remoteParticipants) {
            if (isStreamerClient(c) || isRecorderClient(c)) {
                continue;
            }
            const { presentationStream, ...clientView } = c;
            const displayName = c.displayName || "Guest";
            const isPresentationActive = presentationStream && presentationStream.active;
            const presentationId = "pres-" + c.id;
            const isStreamActive = c.stream && c.stream.active;

            const isVideoEnabled = c.isVideoEnabled;
            views.push({
                ...clientView,
                breakoutGroupAssigned: breakoutAssignments?.[c.deviceId] || "",
                clientId: c.id,
                displayName,
                hasActivePresentation: !!isPresentationActive,
                ...(c.isVideoEnabled ? { isVideoEnabled } : {}),
            });
            if (isPresentationActive) {
                views.push({
                    ...clientView,
                    clientId: c.id,
                    stream: c.presentationStream,
                    displayName: `Screenshare (${displayName})`,
                    id: presentationId,
                    isPresentation: true,
                    isVideoEnabled: true,
                    // Don't show as recording unless this is our only view
                    ...(isStreamActive && { isRecording: null }),
                });
            }
        }
        return views;
    },
);

export const selectAllClientViews = createSelector(
    selectLocalParticipantView,
    selectRemoteClientViews,
    (localParticipant, remoteParticipants) => {
        return [...(localParticipant ? [localParticipant] : []), ...remoteParticipants];
    },
);

export const selectAllClientViewsInCurrentGroup = createSelector(
    selectAllClientViews,
    selectBreakoutActive,
    selectBreakoutCurrentId,
    (allClientViews, breakoutActive, breakoutCurrentId) => {
        if (!breakoutActive || !breakoutCurrentId) {
            return allClientViews;
        }

        return allClientViews.filter(
            (client) =>
                client.isLocalClient ||
                client.breakoutGroup === (breakoutCurrentId || "") ||
                (client.breakoutGroupAssigned && client.breakoutGroupAssigned === breakoutCurrentId),
        );
    },
);
