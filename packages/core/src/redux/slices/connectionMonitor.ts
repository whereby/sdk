import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { setClientProvider, subscribeIssues } from "@whereby.com/media";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";
import { createReactor } from "../listenerMiddleware";
import { selectRoomConnectionStatus } from "./roomConnection";
import { selectRtcManager } from "./rtcConnection";
import { selectAllClientViews } from "./room";

/**
 * Reducer
 */

export interface ConnectionMonitorStart {
    stopIssueSubscription: () => void;
}

export interface ConnectionMonitorState {
    running: boolean;
    stopCallbackFunction?: () => void;
}

const initialState: ConnectionMonitorState = {
    running: false,
};

export const connectionMonitorSlice = createSlice({
    name: "connectionMonitor",
    initialState,
    reducers: {
        connectionMonitorStarted: (state, action: PayloadAction<ConnectionMonitorStart>) => {
            return {
                ...state,
                running: true,
                stopCallbackFunction: action.payload.stopIssueSubscription,
            };
        },
        connectionMonitorStopped: (state) => {
            return {
                ...state,
                running: false,
            };
        },
    },
});

/**
 * Action creators
 */

export const { connectionMonitorStarted, connectionMonitorStopped } = connectionMonitorSlice.actions;

export const doStartConnectionMonitor = createAppThunk(() => (dispatch, getState) => {
    setClientProvider(() => {
        const state = getState();

        const clientViews = selectAllClientViews(state).map((clientView) => ({
            id: clientView.id,
            clientId: clientView.clientId,
            // isAudioOnlyModeEnabled: clientView.isAudioOnlyModeEnabled, // not yet supported in SDK
            isLocalClient: clientView.isLocalClient,
            audio: {
                enabled: clientView.isAudioEnabled,
                track: clientView.stream?.getAudioTracks()[0],
            },
            video: {
                enabled: clientView.isVideoEnabled,
                track: clientView.stream?.getVideoTracks()[0],
            },
            isPresentation: clientView.isPresentation,
        }));

        return clientViews;
    });

    const issueMonitorSubscription = subscribeIssues({
        onUpdatedIssues: (issuesAndMetricsByClients) => {
            const state = getState();
            const rtcManager = selectRtcManager(state);

            if (!rtcManager) {
                return;
            }

            // gather a selection of aggregate metrics
            let lossSend = 0;
            let lossReceive = 0;
            let bitrateSend = 0;
            let bitrateReceive = 0;
            Object.entries(issuesAndMetricsByClients.aggregated.metrics).forEach(
                ([key, value]: [string, { curMax: number; curSum: number }]) => {
                    if (/loc.*packetloss/.test(key)) lossSend = Math.max(lossSend, value.curMax);
                    if (/rem.*packetloss/.test(key)) lossReceive = Math.max(lossReceive, value.curMax);
                    if (/loc.*bitrate/.test(key)) bitrateSend += value.curSum;
                    if (/rem.*bitrate/.test(key)) bitrateReceive += value.curSum;
                },
            );

            // send the selection of aggregate metrics to rtcstats
            rtcManager.sendStatsCustomEvent("insightsStats", {
                ls: Math.round(lossSend * 1000) / 1000,
                lr: Math.round(lossReceive * 1000) / 1000,
                bs: Math.round(bitrateSend),
                br: Math.round(bitrateReceive),
                cpu: issuesAndMetricsByClients.aggregated.metrics["global-cpu-pressure"]?.curSum,
                _time: Date.now(),
            });
        },
    });

    dispatch(connectionMonitorStarted({ stopIssueSubscription: issueMonitorSubscription.stop }));
});

export const doStopConnectionMonitor = createAppThunk(() => (dispatch, getState) => {
    const state = getState();
    const stopCallbackFn = selectStopCallbackFunction(state);
    if (stopCallbackFn) {
        stopCallbackFn();
    }
    dispatch(connectionMonitorStopped());
});

/**
 * Selectors
 */

export const selectConnectionMonitorIsRunning = (state: RootState) => state.connectionMonitor.running;
export const selectStopCallbackFunction = (state: RootState) => state.connectionMonitor.stopCallbackFunction;

export const selectShouldStartConnectionMonitor = createSelector(
    selectRoomConnectionStatus,
    selectConnectionMonitorIsRunning,
    (roomConnectionStatus, isRunning) => {
        if (!isRunning && roomConnectionStatus === "connected") {
            return true;
        }

        return false;
    },
);

export const selectShouldStopConnectionMonitor = createSelector(
    selectRoomConnectionStatus,
    selectConnectionMonitorIsRunning,
    (roomConnectionStatus, isRunning) => {
        if (isRunning && ["kicked", "left"].includes(roomConnectionStatus)) {
            return true;
        }

        return false;
    },
);

/**
 * Reactors
 */

createReactor([selectShouldStartConnectionMonitor], ({ dispatch }, shouldStartConnectionMonitor) => {
    if (shouldStartConnectionMonitor) {
        dispatch(doStartConnectionMonitor());
    }
});

createReactor([selectShouldStopConnectionMonitor], ({ dispatch }, shouldStartConnectionMonitor) => {
    if (shouldStartConnectionMonitor) {
        dispatch(doStopConnectionMonitor());
    }
});
