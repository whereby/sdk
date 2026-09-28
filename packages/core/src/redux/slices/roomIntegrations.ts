import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import {
    RoomIntegrationErrorCode,
    RoomIntegrationProps,
    RoomIntegrationSessionEvent,
    StartRoomIntegrationRequest,
    isRoomIntegrationErrorCode,
} from "@whereby.com/media";

import { RootState } from "../store";
import { roomIntegrationContentTagName } from "../../roomIntegrationContent";
import { RoomIntegrationResponse } from "../../api/roomIntegrationService";
import { createAppAsyncThunk, createRoomConnectedThunk } from "../thunk";
import { createReactor } from "../listenerMiddleware";
import { signalEvents } from "./signalConnection/actions";
import { selectSignalConnectionRaw } from "./signalConnection";
import { selectBreakoutActive, selectBreakoutCurrentId } from "./breakout";
import { selectIsAuthorizedToManageRoomIntegration } from "./authorization";
import { selectOrganizationId } from "./organization";
import { selectAppRoomName, selectAppIsActive } from "./app";
import { selectSelfId } from "./localParticipant/selectors";
import { selectRemoteParticipants } from "./remoteParticipants";
import { selectRoomConnectionStatus } from "./roomConnection/selectors";

export interface RoomIntegration {
    roomIntegrationId: string;
    name: string;
    title: string;
    description: string;
    type: string;
    icons: { small: string; large: string };
    link: { href: string; text: string };
    contentTagName: string;
    entrypoint: string;
    webview: string;
    matcher: RegExp;
    isEmbeddable: boolean;
}

export interface RoomIntegrationSession {
    roomIntegrationSessionId: string;
    roomIntegrationId: string;
    breakoutGroupId: string;
    tagName: string;
    shareUrl: string;
    props: RoomIntegrationProps;
    clientId: string;
    sessionStartedAt: number | null;
}

export interface RoomIntegrationSessionView extends RoomIntegrationSession {
    integration: RoomIntegration;
    isPresenter: boolean;
    presenterDisplayName: string | null;
    canStop: boolean;
}

function isCustomElementName(value: unknown): value is string {
    return typeof value === "string" && value === value.toLowerCase() && value.includes("-");
}

function isHttpsUrl(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

function isValidProps(value: unknown): value is RoomIntegrationProps {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    return Object.values(value as Record<string, unknown>).every(
        (entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry),
    );
}

function parseMatcher(matcher: unknown): RegExp | null {
    if (typeof matcher !== "string") {
        return null;
    }
    const parts = matcher.match(/^\/([\s\S]*)\/([a-z]*)$/);
    if (!parts) {
        return null;
    }
    const flags = (parts[2] || "").replace(/[gy]/g, "");
    try {
        return new RegExp(parts[1], flags);
    } catch {
        return null;
    }
}

export function parseRoomIntegration(response: RoomIntegrationResponse): RoomIntegration | null {
    const { roomIntegrationId, name, title, description, type, icons, link, entrypoint, webview, isEmbeddable } =
        response || ({} as RoomIntegrationResponse);

    const matcher = parseMatcher(response?.matcher);

    if (
        roomIntegrationId === undefined ||
        roomIntegrationId === null ||
        !name ||
        !title ||
        !type ||
        !icons?.small ||
        !icons?.large ||
        !entrypoint ||
        !webview ||
        !matcher
    ) {
        console.warn(`Ignoring malformed room integration: ${name || roomIntegrationId}`);
        return null;
    }

    return {
        roomIntegrationId: String(roomIntegrationId),
        name,
        title,
        description: description || "",
        type,
        contentTagName: roomIntegrationContentTagName(name),
        icons: { small: icons.small, large: icons.large },
        link: { href: link?.href || "", text: link?.text || "" },
        entrypoint,
        webview,
        matcher,
        isEmbeddable: isEmbeddable ?? false,
    };
}

export function parseRoomIntegrationSession(event: RoomIntegrationSessionEvent): RoomIntegrationSession | null {
    const {
        roomIntegrationId,
        roomIntegrationSessionId,
        breakoutGroupId,
        tagName,
        shareUrl,
        props,
        clientId,
        sessionStartedAt,
    } = event || ({} as RoomIntegrationSessionEvent);

    if (
        typeof roomIntegrationSessionId !== "string" ||
        roomIntegrationId === undefined ||
        roomIntegrationId === null ||
        typeof clientId !== "string" ||
        !isCustomElementName(tagName) ||
        !isHttpsUrl(shareUrl) ||
        !isValidProps(props)
    ) {
        console.warn(`Ignoring malformed room integration session: ${roomIntegrationSessionId}`);
        return null;
    }

    return {
        roomIntegrationSessionId,
        roomIntegrationId: String(roomIntegrationId),
        breakoutGroupId: breakoutGroupId || "",
        tagName,
        shareUrl,
        props,
        clientId,
        sessionStartedAt: typeof sessionStartedAt === "number" && isFinite(sessionStartedAt) ? sessionStartedAt : null,
    };
}

export type RoomIntegrationError =
    | RoomIntegrationErrorCode
    | "unknown_integration"
    | "integration_not_enabled"
    | "not_allowed_to_stop"
    | "invalid_content"
    | "unknown";

export interface RoomIntegrationErrorDetail {
    code: RoomIntegrationError;
    message: string;
}

const SIGNAL_ERROR_MESSAGES: Record<RoomIntegrationErrorCode, (action: string) => string> = {
    not_in_a_room: (action) =>
        `Cannot ${action} a room integration: not in a room. The signal connection has a room session, but the server does not consider this client a participant of it.`,
    forbidden: (action) => `Not allowed to ${action} this room integration (forbidden)`,
    missing_parameters: (action) => `Could not ${action} the room integration: the request was missing parameters`,
    invalid_parameters: (action) => `Could not ${action} the room integration: the request had invalid parameters`,
    internal_server_error: (action) => `The server failed to ${action} the room integration`,
};

export function roomIntegrationSignalError(error: string, action: string): RoomIntegrationErrorDetail {
    if (!isRoomIntegrationErrorCode(error)) {
        return { code: "unknown", message: `Could not ${action} the room integration: ${error}` };
    }

    return { code: error, message: SIGNAL_ERROR_MESSAGES[error](action) };
}

/**
 * Reducer
 */
export interface RoomIntegrationsState {
    available: RoomIntegration[];
    unavailable: RoomIntegration[];
    enabled: string[];
    running: RoomIntegrationSession[];
    isFetching: boolean;
    hasFetched: boolean;
    error: RoomIntegrationErrorDetail | null;
}

export const roomIntegrationsSliceInitialState: RoomIntegrationsState = {
    available: [],
    unavailable: [],
    enabled: [],
    running: [],
    isFetching: false,
    hasFetched: false,
    error: null,
};

export const roomIntegrationsSlice = createSlice({
    name: "roomIntegrations",
    initialState: roomIntegrationsSliceInitialState,
    reducers: {
        setRoomIntegrationsError: (state, action: PayloadAction<{ error: RoomIntegrationErrorDetail | null }>) => {
            state.error = action.payload.error;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(doFetchRoomIntegrations.pending, (state) => {
            state.isFetching = true;
        });
        builder.addCase(doFetchRoomIntegrations.fulfilled, (state, action) => {
            const { enabledRoomIntegrations, disabledRoomIntegrations, unavailableRoomIntegrations } = action.payload;

            const parse = (entries: RoomIntegrationResponse[]) =>
                entries.map(parseRoomIntegration).filter((entry): entry is RoomIntegration => entry !== null);

            state.isFetching = false;
            state.hasFetched = true;
            state.error = null;
            state.available = [...parse(enabledRoomIntegrations), ...parse(disabledRoomIntegrations)];
            state.unavailable = parse(unavailableRoomIntegrations);
            state.enabled = enabledRoomIntegrations.map(({ roomIntegrationId }) => String(roomIntegrationId));
        });
        builder.addCase(doFetchRoomIntegrations.rejected, (state, action) => {
            state.isFetching = false;
            state.hasFetched = true;
            state.error = {
                code: "unknown",
                message: action.error.message || "Failed to fetch room integrations",
            };
        });

        builder.addCase(signalEvents.roomJoined, (state, action) => {
            if ("error" in action.payload) {
                return;
            }
            state.running = (action.payload.roomIntegrationSession || [])
                .map(parseRoomIntegrationSession)
                .filter((session): session is RoomIntegrationSession => session !== null);
        });

        builder.addCase(signalEvents.roomIntegrationStarted, (state, action) => {
            if ("error" in action.payload) {
                state.error = roomIntegrationSignalError(action.payload.error, "start");
                return;
            }

            const { roomIntegrationId, roomIntegrationSessionId, breakoutGroupId, sessionStartedAt } = action.payload;
            const session = parseRoomIntegrationSession({
                ...action.payload.state,
                roomIntegrationId,
                roomIntegrationSessionId,
                breakoutGroupId,
                sessionStartedAt,
            });

            if (!session) {
                return;
            }

            const existing = state.running.findIndex(
                (running) => running.roomIntegrationSessionId === session.roomIntegrationSessionId,
            );
            if (existing >= 0) {
                state.running[existing] = session;
                return;
            }
            state.running.push(session);
        });

        builder.addCase(signalEvents.roomIntegrationStopped, (state, action) => {
            if ("error" in action.payload) {
                state.error = roomIntegrationSignalError(action.payload.error, "stop");
                return;
            }

            const { roomIntegrationSessionId } = action.payload;
            state.running = state.running.filter(
                (running) => running.roomIntegrationSessionId !== roomIntegrationSessionId,
            );
        });

        builder.addCase(signalEvents.roomIntegrationPropsUpdated, (state, action) => {
            if ("error" in action.payload) {
                state.error = roomIntegrationSignalError(action.payload.error, "update the props of");
                return;
            }

            const { roomIntegrationSessionId, props } = action.payload;
            const session = state.running.find(
                (running) => running.roomIntegrationSessionId === roomIntegrationSessionId,
            );

            if (!session || !isValidProps(props)) {
                return;
            }

            session.props = { ...session.props, ...props };
        });

        builder.addCase(signalEvents.roomIntegrationEnabled, (state, action) => {
            const roomIntegrationId = String(action.payload.roomIntegrationId);
            if (!state.enabled.includes(roomIntegrationId)) {
                state.enabled.push(roomIntegrationId);
            }
        });

        builder.addCase(signalEvents.roomIntegrationDisabled, (state, action) => {
            const roomIntegrationId = String(action.payload.roomIntegrationId);
            state.enabled = state.enabled.filter((id) => id !== roomIntegrationId);
        });
    },
});

export const { setRoomIntegrationsError } = roomIntegrationsSlice.actions;

/**
 * Action creators
 */

export const doFetchRoomIntegrations = createAppAsyncThunk(
    "roomIntegrations/doFetchRoomIntegrations",
    async (_, { extra, getState }) => {
        const state = getState();
        const organizationId = selectOrganizationId(state);
        const roomName = selectAppRoomName(state);

        if (!organizationId || !roomName) {
            throw new Error("Cannot fetch room integrations before the organization and room are known");
        }

        return extra.services.roomIntegrationService.findRoomIntegrations({ organizationId, roomName });
    },
);

export const doStartRoomIntegration = createRoomConnectedThunk(
    (payload: { roomIntegrationId: string; tagName: string; shareUrl: string; props?: RoomIntegrationProps }) =>
        (dispatch, getState) => {
            const state = getState();
            const { roomIntegrationId, tagName, shareUrl, props = {} } = payload;

            const integration = selectRoomIntegrationsRaw(state).available.find(
                (entry) => entry.roomIntegrationId === roomIntegrationId,
            );

            if (!integration) {
                dispatch(
                    setRoomIntegrationsError({
                        error: {
                            code: "unknown_integration",
                            message: `Unknown room integration: ${roomIntegrationId}`,
                        },
                    }),
                );
                return;
            }

            if (!selectRoomIntegrationsEnabled(state).includes(roomIntegrationId)) {
                dispatch(
                    setRoomIntegrationsError({
                        error: {
                            code: "integration_not_enabled",
                            message: `Room integration is not enabled for this room: ${integration.name}`,
                        },
                    }),
                );
                return;
            }

            if (!isCustomElementName(tagName)) {
                dispatch(
                    setRoomIntegrationsError({
                        error: {
                            code: "invalid_content",
                            message: `tagName must be a valid custom element name, got: ${tagName}`,
                        },
                    }),
                );
                return;
            }

            if (!isHttpsUrl(shareUrl)) {
                dispatch(
                    setRoomIntegrationsError({
                        error: {
                            code: "invalid_content",
                            message: `shareUrl must be an https url, got: ${shareUrl}`,
                        },
                    }),
                );
                return;
            }

            if (!isValidProps(props)) {
                dispatch(
                    setRoomIntegrationsError({
                        error: {
                            code: "invalid_content",
                            message: "props must be a flat object of primitive values",
                        },
                    }),
                );
                return;
            }

            const clientId = selectSelfId(state);
            if (!clientId) {
                return;
            }

            dispatch(setRoomIntegrationsError({ error: null }));

            const request: StartRoomIntegrationRequest = {
                roomIntegrationId: Number(roomIntegrationId),
                breakoutGroupId: selectBreakoutCurrentId(state) || null,
                state: { tagName, shareUrl, props, clientId },
            };

            selectSignalConnectionRaw(state).socket?.emit("start_room_integration", request);
        },
);

export const ROOM_INTEGRATION_PICKER_MESSAGES = {
    FORM_SUBMIT: "whereby:formSubmit",
    FORM_CLOSE: "whereby:formClose",
    ERROR: "whereby:bootstrapError",
} as const;

export interface RoomIntegrationPickerResult {
    tagName: string;
    shareUrl: string;
    props: RoomIntegrationProps;
}

export function roomIntegrationPickerUrl({
    integration,
    parentOrigin,
    featureSource,
}: {
    integration: Pick<RoomIntegration, "webview">;
    parentOrigin: string;
    featureSource?: string;
}) {
    const url = new URL("bootstrap.html", integration.webview);
    url.searchParams.set("parentOrigin", parentOrigin);
    if (featureSource) {
        url.searchParams.set("featuresource", featureSource);
    }
    return url.href;
}

export const doStopRoomIntegration = createRoomConnectedThunk(
    (payload: { roomIntegrationSessionId: string; intent?: "stop" | "end" }) => (dispatch, getState) => {
        const state = getState();
        const { roomIntegrationSessionId, intent = "stop" } = payload;

        const session = selectRunningRoomIntegrations(state).find(
            (running) => running.roomIntegrationSessionId === roomIntegrationSessionId,
        );

        if (!session) {
            dispatch(
                setRoomIntegrationsError({
                    error: {
                        code: "unknown_integration",
                        message: `No running room integration with session id: ${roomIntegrationSessionId}`,
                    },
                }),
            );
            return;
        }

        if (!session.canStop) {
            dispatch(
                setRoomIntegrationsError({
                    error: {
                        code: "not_allowed_to_stop",
                        message: "Only the participant who started a room integration, or a host, can stop it",
                    },
                }),
            );
            return;
        }

        dispatch(setRoomIntegrationsError({ error: null }));

        selectSignalConnectionRaw(state).socket?.emit("stop_room_integration", { roomIntegrationSessionId, intent });
    },
);

export const doUpdateRoomIntegrationProps = createRoomConnectedThunk(
    (payload: { roomIntegrationSessionId: string; props: RoomIntegrationProps }) => (dispatch, getState) => {
        const state = getState();
        const { roomIntegrationSessionId, props } = payload;

        if (!isValidProps(props)) {
            dispatch(
                setRoomIntegrationsError({
                    error: {
                        code: "invalid_content",
                        message: "props must be a flat object of primitive values",
                    },
                }),
            );
            return;
        }

        selectSignalConnectionRaw(state).socket?.emit("update_room_integration_props", {
            roomIntegrationSessionId,
            props,
        });
    },
);

/**
 * Selectors
 */
export const selectRoomIntegrationsRaw = (state: RootState) => state.roomIntegrations;
export const selectRoomIntegrationsError = (state: RootState) => state.roomIntegrations.error;
export const selectRoomIntegrationsIsFetching = (state: RootState) => state.roomIntegrations.isFetching;
export const selectRoomIntegrationsHasFetched = (state: RootState) => state.roomIntegrations.hasFetched;
export const selectRoomIntegrationsEnabled = (state: RootState) => state.roomIntegrations.enabled;
export const selectAvailableRoomIntegrations = (state: RootState) => state.roomIntegrations.available;
export const selectUnavailableRoomIntegrations = (state: RootState) => state.roomIntegrations.unavailable;
export const selectEnabledRoomIntegrations = createSelector(
    selectAvailableRoomIntegrations,
    selectRoomIntegrationsEnabled,
    (available, enabled) => available.filter((integration) => enabled.includes(integration.roomIntegrationId)),
);
export const selectEmbeddableRoomIntegrations = createSelector(selectEnabledRoomIntegrations, (enabled) =>
    enabled.filter((integration) => integration.isEmbeddable),
);
export const selectRunningRoomIntegrations = createSelector(
    selectRoomIntegrationsRaw,
    selectEnabledRoomIntegrations,
    selectBreakoutActive,
    selectBreakoutCurrentId,
    selectSelfId,
    selectRemoteParticipants,
    selectIsAuthorizedToManageRoomIntegration,
    (
        raw,
        enabledIntegrations,
        breakoutActive,
        breakoutCurrentId,
        selfId,
        remoteParticipants,
        canManageRoomIntegration,
    ) => {
        const currentGroupId = breakoutActive ? breakoutCurrentId : "";

        return raw.running.reduce<RoomIntegrationSessionView[]>((acc, session) => {
            if (session.breakoutGroupId !== currentGroupId) {
                return acc;
            }

            const integration = enabledIntegrations.find(
                (entry) => entry.roomIntegrationId === session.roomIntegrationId,
            );
            if (!integration) {
                return acc;
            }

            const isPresenter = !!selfId && session.clientId === selfId;

            acc.push({
                ...session,
                integration,
                isPresenter,
                canStop: isPresenter || canManageRoomIntegration,
                presenterDisplayName: isPresenter
                    ? null
                    : remoteParticipants.find((participant) => participant.id === session.clientId)?.displayName ||
                      null,
            });
            return acc;
        }, []);
    },
);
export const selectIsRoomIntegrationRunning = createSelector(
    selectRunningRoomIntegrations,
    (running) => running.length > 0,
);

export const selectRoomIntegrationForUrl = createSelector(
    selectEmbeddableRoomIntegrations,
    (integrations) => (url: string) => integrations.find((integration) => integration.matcher.test(url)) || null,
);

/**
 * Reactors
 */

export const selectShouldFetchRoomIntegrations = createSelector(
    selectAppIsActive,
    selectRoomConnectionStatus,
    selectOrganizationId,
    selectAppRoomName,
    selectRoomIntegrationsRaw,
    (appIsActive, connectionStatus, organizationId, roomName, raw) =>
        appIsActive &&
        connectionStatus === "connected" &&
        !!organizationId &&
        !!roomName &&
        !raw.hasFetched &&
        !raw.isFetching,
);

createReactor([selectShouldFetchRoomIntegrations], ({ dispatch }, shouldFetchRoomIntegrations) => {
    if (shouldFetchRoomIntegrations) {
        dispatch(doFetchRoomIntegrations());
    }
});
