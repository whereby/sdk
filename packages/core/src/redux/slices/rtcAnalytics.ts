import { AsyncThunk, ActionCreatorWithPayload, PayloadAction, createSlice, isAnyOf } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { ThunkConfig, createAppThunk } from "../thunk";
import { createReactor, startAppListening } from "../listenerMiddleware";
import { selectRtcConnectionRaw, selectRtcManagerInitialized, selectRtcStatus } from "./rtcConnection";
import { selectAppExternalId } from "./app";
import { selectOrganizationId, selectOrganizationPreferences } from "./organization";
import { doEnableAudio, doEnableVideo, setDisplayName } from "./localParticipant";
import { selectLocalParticipantDisplayName, selectSelfId } from "./localParticipant/selectors";
import { selectAuthorizationRoleName } from "./authorization";
import { selectSignalStatus } from "./signalConnection";
import { selectDeviceId } from "./deviceCredentials";
import { doSetDevice, selectIsCameraEnabled, selectIsMicrophoneEnabled, selectLocalMediaStream } from "./localMedia";
import { doStartScreenshare, selectLocalScreenshareStream, stopScreenshare } from "./localScreenshare";
import { selectRoomConnectionSessionId } from "./roomConnection/selectors";
import { signalEvents } from "./signalConnection/actions";

type RtcAnalyticsCustomEvent = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: Array<ActionCreatorWithPayload<any> | AsyncThunk<any, any, ThunkConfig>["fulfilled"]> | null;
    rtcEventName: string;
    getValue: (state: RootState) => unknown;
    getOutput: (value: unknown) => unknown;
};

export const rtcAnalyticsCustomEvents: { [key: string]: RtcAnalyticsCustomEvent } = {
    audioEnabled: {
        actions: [doEnableAudio.fulfilled],
        rtcEventName: "audioEnabled",
        getValue: (state: RootState) => selectIsMicrophoneEnabled(state),
        getOutput: (value) => ({ enabled: value }),
    },
    videoEnabled: {
        actions: [doEnableVideo.fulfilled],
        rtcEventName: "videoEnabled",
        getValue: (state: RootState) => selectIsCameraEnabled(state),
        getOutput: (value) => ({ enabled: value }),
    },
    localStream: {
        actions: [doSetDevice.fulfilled],
        rtcEventName: "localStream",
        getValue: (state: RootState) =>
            selectLocalMediaStream(state)
                ?.getTracks()
                .map((track) => ({ id: track.id, kind: track.kind, label: track.label })),
        getOutput: (value) => ({ stream: value }),
    },
    localScreenshareStream: {
        actions: [doStartScreenshare.fulfilled],
        rtcEventName: "localScreenshareStream",
        getValue: (state: RootState) =>
            selectLocalScreenshareStream(state)
                ?.getTracks()
                .map((track) => ({ id: track.id, kind: track.kind, label: track.label })),
        getOutput: (value) => ({ tracks: value }),
    },
    localScreenshareStreamStopped: {
        actions: [stopScreenshare],
        rtcEventName: "localScreenshareStream",
        getValue: () => () => null,
        getOutput: () => ({}),
    },
    displayName: {
        actions: [setDisplayName],
        rtcEventName: "displayName",
        getValue: (state: RootState) => {
            const displayName = selectLocalParticipantDisplayName(state);
            const prefs = selectOrganizationPreferences(state);

            return prefs?.hideInsightsDisplayNames ? "[[redacted]]" : displayName;
        },
        getOutput: (value) => ({ displayName: value }),
    },
    clientId: {
        actions: null,
        rtcEventName: "clientId",
        getValue: (state: RootState) => selectSelfId(state),
        getOutput: (value) => ({ clientId: value }),
    },
    deviceId: {
        actions: null,
        rtcEventName: "deviceId",
        getValue: (state: RootState) => selectDeviceId(state),
        getOutput: (value) => ({ deviceId: value }),
    },
    externalId: {
        actions: null,
        rtcEventName: "externalId",
        getValue: (state: RootState) => selectAppExternalId(state),
        getOutput: (value) => ({ externalId: value }),
    },
    organizationId: {
        actions: null,
        rtcEventName: "organizationId",
        getValue: (state: RootState) => selectOrganizationId(state),
        getOutput: (value) => ({ organizationId: value }),
    },
    signalConnectionStatus: {
        actions: null,
        rtcEventName: "signalConnectionStatus",
        getValue: (state: RootState) => selectSignalStatus(state),
        getOutput: (value) => ({ status: value }),
    },
    roomSessionId: {
        actions: [
            signalEvents.newClient,
            signalEvents.roomJoined,
            signalEvents.roomSessionEnded,
            signalEvents.clientLeft,
        ],
        rtcEventName: "roomSessionId",
        getValue: (state: RootState) => selectRoomConnectionSessionId(state),
        getOutput: (value) => ({ roomSessionId: value }),
    },
    rtcConnectionStatus: {
        actions: null,
        rtcEventName: "rtcConnectionStatus",
        getValue: (state: RootState) => selectRtcStatus(state),
        getOutput: (value) => ({ status: value }),
    },
    userRole: {
        actions: null,
        rtcEventName: "userRole",
        getValue: (state: RootState) => selectAuthorizationRoleName(state),
        getOutput: (value) => ({ userRole: value }),
    },
};

const rtcCustomEventActions = Object.values(rtcAnalyticsCustomEvents)
    .flatMap(({ actions }) => actions?.map((action) => action) ?? null)
    .filter(
        (
            action,
        ): action is
            | ActionCreatorWithPayload<unknown, string>
            | AsyncThunk<unknown, unknown, ThunkConfig>["fulfilled"] => action !== null,
    );

const makeComparable = (value: unknown) => {
    if (typeof value === "object") return JSON.stringify(value);

    return value;
};

/**
 * Reducer
 */

export interface rtcAnalyticsState {
    reportedValues: { [key: string]: unknown };
}

export const rtcAnalyticsSliceInitialState: rtcAnalyticsState = {
    reportedValues: {},
};

export const rtcAnalyticsSlice = createSlice({
    name: "rtcAnalytics",
    initialState: rtcAnalyticsSliceInitialState,
    reducers: {
        updateReportedValues(state, action: PayloadAction<{ rtcEventName: string; value: unknown }>) {
            return {
                ...state,
                reportedValues: {
                    ...state.reportedValues,
                    [action.payload.rtcEventName]: action.payload.value,
                },
            };
        },
    },
});

export const doRtcAnalyticsCustomEventsInitialize = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const rtcManager = selectRtcConnectionRaw(state).rtcManager;

    if (!rtcManager) return;

    // RTC stats require a `insightsStats` event to be sent to set the timestamp.
    // This is a temporary workaround, we just send one dummy event on initialization.
    rtcManager.sendStatsCustomEvent("insightsStats", {
        _time: Date.now(),
        ls: 0,
        lr: 0,
        bs: 0,
        br: 0,
        cpu: 0,
    });

    Object.values(rtcAnalyticsCustomEvents).forEach(({ rtcEventName, getValue, getOutput }) => {
        const value = getValue(state);
        const output = { ...(getOutput(value) as Record<string, unknown>), _time: Date.now() };

        const comparableValue = makeComparable(value);

        if (state.rtcAnalytics.reportedValues?.[rtcEventName] !== comparableValue) {
            rtcManager.sendStatsCustomEvent(rtcEventName, output);
            dispatch(updateReportedValues({ rtcEventName, value }));
        }
    });
});

/**
 * Action creators
 */
export const { updateReportedValues } = rtcAnalyticsSlice.actions;

startAppListening({
    matcher: isAnyOf(...rtcCustomEventActions),
    effect: ({ type }, { getState, dispatch }) => {
        const state: RootState = getState();

        const rtcManager = selectRtcConnectionRaw(state).rtcManager;
        if (!rtcManager) return;

        const rtcCustomEvent = Object.values(rtcAnalyticsCustomEvents).find(({ actions }) =>
            actions?.map((a) => a.type).includes(type),
        );
        if (!rtcCustomEvent) return;

        const { getValue, getOutput, rtcEventName } = rtcCustomEvent;

        const value = getValue(state);
        const comparableValue = makeComparable(value);
        const output = { ...(getOutput(value) as Record<string, unknown>), _time: Date.now() };

        if (state.rtcAnalytics.reportedValues?.[rtcEventName] !== comparableValue) {
            rtcManager.sendStatsCustomEvent(rtcEventName, output);
            dispatch(updateReportedValues({ rtcEventName, value }));
        }
    },
});

/**
 * Reactors
 */

createReactor([selectRtcManagerInitialized], ({ dispatch }, selectRtcManagerInitialized) => {
    if (selectRtcManagerInitialized) {
        dispatch(doRtcAnalyticsCustomEventsInitialize());
    }
});
