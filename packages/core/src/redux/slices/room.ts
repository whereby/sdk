import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RoomMode } from "@whereby.com/media";
import { RootState } from "../store";
import { createAppAsyncThunk, createAppAuthorizedThunk } from "../thunk";
import { createReactor } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";
import { appSlice, doAppStop, selectAppIsActive } from "./app";
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
import {
    selectBreakoutActive,
    selectBreakoutAssignments,
    selectBreakoutCurrentId,
    selectBreakoutGroups,
} from "./breakout";

function isStreamerClient(client: RemoteParticipant) {
    return client.roleName === "streamer";
}

function isRecorderClient(client: RemoteParticipant) {
    return client.roleName === "recorder";
}

/**
 * Reducer
 */

// Outside a room, a lock event is a late one from the room just left.
function lockStateFromSignal(state: RoomState, isLocked: boolean): RoomState {
    if (!state.isInRoom) {
        return state;
    }

    return {
        ...state,
        isLocked,
        lockStateSource: "signal",
        roomFetchStatus: "fetched",
        roomFetchRequestId: null,
    };
}

/** @internal For Whereby's own development. May change without notice. */
export type RoomLockStateSource = "fetch" | "signal";

/** @internal For Whereby's own development. May change without notice. */
export type RoomFetchStatus = "idle" | "fetching" | "fetched" | "failed";

export interface RoomState {
    isLocked: boolean;
    lockStateSource: RoomLockStateSource | null;
    lockStateRoomUrl: string | null;
    requestedRoomUrl: string | null;
    roomFetchStatus: RoomFetchStatus;
    roomFetchRequestId: string | null;
    // Mirrors app.isActive, which this slice can't read.
    isInRoom: boolean;
    mode: RoomMode | null;
}

export const roomSliceInitialState: RoomState = {
    isLocked: false,
    lockStateSource: null,
    lockStateRoomUrl: null,
    requestedRoomUrl: null,
    roomFetchStatus: "idle",
    roomFetchRequestId: null,
    isInRoom: false,
    mode: null,
};

export const roomSlice = createSlice({
    name: "room",
    initialState: roomSliceInitialState,
    reducers: {
        setRequestedRoomUrl: (state, action: PayloadAction<string | null>) => {
            if (state.roomFetchStatus === "failed") {
                return {
                    ...state,
                    requestedRoomUrl: action.payload,
                    roomFetchStatus: "idle",
                };
            }

            if (action.payload === state.requestedRoomUrl) {
                return state;
            }

            return {
                ...state,
                requestedRoomUrl: action.payload,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(appSlice.actions.doAppStart, (state) => {
            return { ...state, isInRoom: true };
        });

        builder.addCase(appSlice.actions.doAppStop, (state) => {
            return { ...state, isInRoom: false };
        });

        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if ("error" in action.payload) {
                if (action.payload.error === "room_locked") {
                    return lockStateFromSignal(state, Boolean(action.payload.isLocked));
                }

                return state;
            }

            const { room } = action.payload;

            return {
                ...lockStateFromSignal(state, Boolean(room.isLocked)),
                // Signal re-sends room_joined when the room switches between modes, so this stays
                // current. Fall back to the presence of an SFU, which is what decides P2P vs SFU.
                mode: room.mode ?? (room.sfuServer ? "group" : "normal"),
            };
        });

        builder.addCase(signalEvents.roomLocked, (state, action) => {
            return lockStateFromSignal(state, Boolean(action.payload.isLocked));
        });

        builder.addCase(doFetchRoom.pending, (state, action) => {
            return {
                ...state,
                isLocked: false,
                lockStateSource: null,
                lockStateRoomUrl: action.meta.arg,
                roomFetchStatus: "fetching",
                roomFetchRequestId: action.meta.requestId,
            };
        });

        builder.addCase(doFetchRoom.fulfilled, (state, action) => {
            if (action.meta.requestId !== state.roomFetchRequestId) {
                return state;
            }

            return {
                ...state,
                isLocked: action.payload.isLocked ?? false,
                lockStateSource: action.payload.isLocked === null ? null : "fetch",
                roomFetchStatus: "fetched",
            };
        });

        builder.addCase(doFetchRoom.rejected, (state, action) => {
            if (action.meta.requestId !== state.roomFetchRequestId) {
                return state;
            }

            return {
                ...state,
                roomFetchStatus: "failed",
            };
        });
    },
});

/**
 * Action creators
 */

/** @internal For Whereby's own development. May change without notice. */
export const { setRequestedRoomUrl } = roomSlice.actions;

/** @internal For Whereby's own development. May change without notice. */
export const doFetchRoom = createAppAsyncThunk("room/doFetchRoom", async (roomUrl: string, { extra }) => {
    const room = await extra.services.fetchRoomFromRoomUrl(roomUrl);

    return { isLocked: room.isClaimed && !room.isBanned ? Boolean(room.isLocked) : null };
});

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
/** @internal For Whereby's own development. May change without notice. */
export const selectRoomLockStateSource = (state: RootState) => state.room.lockStateSource;
/** @internal For Whereby's own development. May change without notice. */
export const selectRoomLockStateRoomUrl = (state: RootState) => state.room.lockStateRoomUrl;
/** @internal For Whereby's own development. May change without notice. */
export const selectRoomRequestedUrl = (state: RootState) => state.room.requestedRoomUrl;
/** @internal For Whereby's own development. May change without notice. */
export const selectRoomFetchStatus = (state: RootState) => state.room.roomFetchStatus;

/** Whether the room is locked, or null while that isn't known. */
export const selectRoomLockState = createSelector(selectRoomIsLocked, selectRoomLockStateSource, (isLocked, source) =>
    source ? isLocked : null,
);

/** @internal For Whereby's own development. May change without notice. */
export const selectShouldFetchRoom = createSelector(
    selectAppIsActive,
    selectRoomRequestedUrl,
    selectRoomLockStateRoomUrl,
    selectRoomFetchStatus,
    (appIsActive, requestedRoomUrl, lockStateRoomUrl, roomFetchStatus) =>
        !appIsActive && !!requestedRoomUrl && (requestedRoomUrl !== lockStateRoomUrl || roomFetchStatus === "idle"),
);
export const selectRoomMode = (state: RootState) => state.room.mode;

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

export const selectRemoteScreenshareVideoTrackIds = createSelector(
    selectScreenshares,
    (screenshares) =>
        screenshares
            .filter((screenshare) => !screenshare.isLocal)
            .flatMap((screenshare) => screenshare.stream?.getVideoTracks().map((track) => track.id) ?? []),
    {
        memoizeOptions: {
            // Only produce a new array (and trigger reactors) when the track ids actually change
            resultEqualityCheck: (a: string[], b: string[]) =>
                a.length === b.length && a.every((trackId, index) => trackId === b[index]),
        },
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

export const selectBreakoutGroupedParticipants = createSelector(
    selectAllClientViews,
    selectBreakoutActive,
    selectBreakoutGroups,
    (clientViews, breakoutActive, breakoutGroups) => {
        if (!breakoutActive || !breakoutGroups) return [];

        const clientsInMainRoom = clientViews.filter((client) => !client.breakoutGroup || client.breakoutGroup === "");

        const mainRoom = {
            clients: clientsInMainRoom,
            group: { id: "", name: "" },
        };

        const groups = Object.entries(breakoutGroups).map(([id, name]) => ({
            clients: clientViews.filter((client) => !client.isPresentation && client.breakoutGroup === id),
            group: { id, name },
        }));

        return [mainRoom, ...groups];
    },
);

/**
 * Reactors
 */

createReactor([selectShouldFetchRoom], ({ dispatch, getState }, shouldFetchRoom) => {
    const roomUrl = selectRoomRequestedUrl(getState());

    if (shouldFetchRoom && roomUrl) {
        dispatch(doFetchRoom(roomUrl));
    }
});
