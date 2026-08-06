import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { RoomIntegrationProps, RoomIntegrationSessionEvent, StartRoomIntegrationRequest } from "@whereby.com/media";

import { RootState } from "../store";
import { roomIntegrationContentTagName } from "../../roomIntegrationContent";
import { RoomIntegrationResponse } from "../../api/roomIntegrationService";
import { createAppAsyncThunk, createAsyncRoomConnectedThunk, createRoomConnectedThunk } from "../thunk";
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

/**
 * A running instance of an integration, shared with everyone in the room (or breakout group).
 */
export interface RoomIntegrationSession {
    roomIntegrationSessionId: string;
    roomIntegrationId: string;
    breakoutGroupId: string;
    tagName: string;
    shareUrl: string;
    props: RoomIntegrationProps;
    clientId: string;
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
    const { roomIntegrationId, roomIntegrationSessionId, breakoutGroupId, tagName, shareUrl, props, clientId } =
        event || ({} as RoomIntegrationSessionEvent);

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
    };
}

/**
 * Reducer
 */
export interface RoomIntegrationsState {
    available: RoomIntegration[];
    unavailable: RoomIntegration[];
    /** roomIntegrationIds enabled for this room. */
    enabled: string[];
    running: RoomIntegrationSession[];
    isFetching: boolean;
    hasFetched: boolean;
    error: string | null;
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
        setRoomIntegrationsError: (state, action: PayloadAction<{ error: string | null }>) => {
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
            state.error = action.error.message || "Failed to fetch room integrations";
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
            const { roomIntegrationId, roomIntegrationSessionId, breakoutGroupId } = action.payload;
            const session = parseRoomIntegrationSession({
                roomIntegrationId,
                roomIntegrationSessionId,
                breakoutGroupId,
                ...action.payload.state,
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
            state.running = state.running.filter(
                (running) => running.roomIntegrationSessionId !== action.payload.roomIntegrationSessionId,
            );
        });

        builder.addCase(signalEvents.roomIntegrationPropsUpdated, (state, action) => {
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
                const error = `Unknown room integration: ${roomIntegrationId}`;
                console.warn(error);
                dispatch(setRoomIntegrationsError({ error }));
                return;
            }

            if (!selectRoomIntegrationsEnabled(state).includes(roomIntegrationId)) {
                const error = `Room integration is not enabled for this room: ${integration.name}`;
                console.warn(error);
                dispatch(setRoomIntegrationsError({ error }));
                return;
            }

            if (!isCustomElementName(tagName)) {
                const error = `tagName must be a valid custom element name, got: ${tagName}`;
                console.warn(error);
                dispatch(setRoomIntegrationsError({ error }));
                return;
            }

            if (!isHttpsUrl(shareUrl)) {
                const error = `shareUrl must be an https url, got: ${shareUrl}`;
                console.warn(error);
                dispatch(setRoomIntegrationsError({ error }));
                return;
            }

            if (!isValidProps(props)) {
                const error = "props must be a flat object of primitive values";
                console.warn(error);
                dispatch(setRoomIntegrationsError({ error }));
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

export const STOP_ROOM_INTEGRATION_NOT_ALLOWED_ERROR =
    "Only the participant who started a room integration, or a host, can stop it";

const PICKER_MESSAGES = {
    FORM_SUBMIT: "whereby:formSubmit",
    FORM_CLOSE: "whereby:formClose",
    ERROR: "whereby:bootstrapError",
} as const;

const PICKER_WINDOW_FEATURES = "width=800,height=600,menubar=0,toolbar=0,location=0,personalbar=0,status=0";

export function roomIntegrationPickerUrl({
    integration,
    parentOrigin,
    featureSource,
}: {
    integration: RoomIntegration;
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

export const ROOM_INTEGRATION_PICKER_BLOCKED_ERROR =
    "Could not open the room integration picker — the popup was blocked. Call this directly from a user gesture.";

interface PickerResult {
    tagName: string;
    shareUrl: string;
    props: RoomIntegrationProps;
}

function awaitPickerResult({
    popup,
    pickerOrigin,
}: {
    popup: Window;
    pickerOrigin: string;
}): Promise<PickerResult | null> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            settled = true;
            window.removeEventListener("message", handleMessage);
            clearInterval(closedTimer);
        };

        const handleMessage = (event: MessageEvent) => {
            if (settled || event.origin !== pickerOrigin || event.source !== popup) {
                return;
            }

            const { type, payload } = event.data || {};

            if (type === PICKER_MESSAGES.FORM_SUBMIT) {
                cleanup();
                resolve(payload as PickerResult);
            } else if (type === PICKER_MESSAGES.FORM_CLOSE) {
                cleanup();
                resolve(null);
            } else if (type === PICKER_MESSAGES.ERROR) {
                cleanup();
                reject(new Error(payload?.message || "The room integration picker failed"));
            }
        };

        const closedTimer = setInterval(() => {
            if (settled || !popup.closed) {
                return;
            }
            cleanup();
            resolve(null);
        }, 500);

        window.addEventListener("message", handleMessage);
    });
}

export const doStartRoomIntegrationWithPicker = createAsyncRoomConnectedThunk(
    "roomIntegrations/startWithPicker",
    async (payload: { roomIntegrationId: string; featureSource?: string }, { dispatch, getState }) => {
        const state = getState();
        const { roomIntegrationId, featureSource } = payload;

        const integration = selectAvailableRoomIntegrations(state).find(
            (entry) => entry.roomIntegrationId === roomIntegrationId,
        );

        if (!integration) {
            const error = `Unknown room integration: ${roomIntegrationId}`;
            dispatch(setRoomIntegrationsError({ error }));
            throw new Error(error);
        }

        if (!selectRoomIntegrationsEnabled(state).includes(roomIntegrationId)) {
            const error = `Room integration is not enabled for this room: ${integration.name}`;
            dispatch(setRoomIntegrationsError({ error }));
            throw new Error(error);
        }

        const pickerOrigin = new URL(integration.webview).origin;
        const url = roomIntegrationPickerUrl({ integration, parentOrigin: window.location.origin, featureSource });

        const popup = window.open(url, `whereby-room-integration-picker-${integration.name}`, PICKER_WINDOW_FEATURES);

        if (!popup) {
            dispatch(setRoomIntegrationsError({ error: ROOM_INTEGRATION_PICKER_BLOCKED_ERROR }));
            throw new Error(ROOM_INTEGRATION_PICKER_BLOCKED_ERROR);
        }

        dispatch(setRoomIntegrationsError({ error: null }));

        let result: PickerResult | null;
        try {
            result = await awaitPickerResult({ popup, pickerOrigin });
        } catch (error) {
            dispatch(setRoomIntegrationsError({ error: (error as Error).message }));
            throw error;
        }

        if (!result) {
            return false;
        }

        dispatch(
            doStartRoomIntegration({
                roomIntegrationId,
                tagName: result.tagName,
                shareUrl: result.shareUrl,
                props: result.props,
            }),
        );

        return true;
    },
);

export const doStopRoomIntegration = createRoomConnectedThunk(
    (payload: { roomIntegrationSessionId: string; intent?: "stop" | "end" }) => (dispatch, getState) => {
        const state = getState();
        const { roomIntegrationSessionId, intent = "stop" } = payload;

        const session = selectRunningRoomIntegrations(state).find(
            (running) => running.roomIntegrationSessionId === roomIntegrationSessionId,
        );

        if (!session) {
            const error = `No running room integration with session id: ${roomIntegrationSessionId}`;
            console.warn(error);
            dispatch(setRoomIntegrationsError({ error }));
            return;
        }

        if (!session.canStop) {
            console.warn(STOP_ROOM_INTEGRATION_NOT_ALLOWED_ERROR);
            dispatch(setRoomIntegrationsError({ error: STOP_ROOM_INTEGRATION_NOT_ALLOWED_ERROR }));
            return;
        }

        dispatch(setRoomIntegrationsError({ error: null }));

        selectSignalConnectionRaw(state).socket?.emit("stop_room_integration", { roomIntegrationSessionId, intent });
    },
);

export const doUpdateRoomIntegrationProps = createRoomConnectedThunk(
    (payload: { roomIntegrationSessionId: string; props: RoomIntegrationProps }) => (_, getState) => {
        const state = getState();
        const { roomIntegrationSessionId, props } = payload;

        if (!isValidProps(props)) {
            console.warn("props must be a flat object of primitive values");
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
