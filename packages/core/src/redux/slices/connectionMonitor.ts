import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import { AggregatedIssues, IssueData, RoomMode, setClientProvider, subscribeIssues } from "@whereby.com/media";
import { RootState } from "../store";
import { createAppThunk } from "../thunk";
import { createReactor } from "../listenerMiddleware";
import { selectRoomConnectionStatus } from "./roomConnection/selectors";
import { rtcEvents, selectRtcManager } from "./rtcConnection";
import { selectAllClientViews, selectRemoteClientViews, selectRoomMode } from "./room";
import { selectLocalParticipantView, selectSelfId } from "./localParticipant/selectors";

export const CALL_QUALITY_LEVELS = {
    CRITICAL: "critical",
    WARNING: "warning",
    OK: "ok",
} as const;

export type CallQualityLevel = (typeof CALL_QUALITY_LEVELS)[keyof typeof CALL_QUALITY_LEVELS];

export type ConnectionMonitorReport = {
    critical: Record<string, { video?: Array<string>; audio?: Array<string> }>;
    warning: Record<string, { video?: Array<string>; audio?: Array<string> }>;
};

export type CallQualityScore = {
    total: CallQualityLevel;
    video: CallQualityLevel;
    audio: CallQualityLevel;
};

export type RemoteCallQualityScores = Record<string, CallQualityScore>;

export type RemoteParticipantQualityReport = Record<string, { quality: CallQualityLevel }>;

export type MediaQualityScores = Record<string, { video?: CallQualityLevel; audio?: CallQualityLevel }>;

const CALL_QUALITY_LEVEL_ORDER: Array<CallQualityLevel> = Object.values(CALL_QUALITY_LEVELS);

function convertQualityScoreToNumber(score: CallQualityLevel) {
    return score !== undefined && score !== null
        ? CALL_QUALITY_LEVEL_ORDER.indexOf(score)
        : CALL_QUALITY_LEVEL_ORDER.indexOf(CALL_QUALITY_LEVELS.OK);
}

const getActiveIssues = (
    allIssues:
        | {
              [issueKey: string]: IssueData;
          }
        | AggregatedIssues,
    issuesToCheck: Array<string> = [],
) =>
    Object.keys(allIssues).reduce<Array<string>>((issuesAcc, issueKey) => {
        const issue = allIssues[issueKey];

        if (!issue) return issuesAcc;

        if (issuesToCheck.includes(issueKey) && issue.active && issue.registered > 2) {
            return [...issuesAcc, issueKey];
        }

        return issuesAcc;
    }, []);

const addMetricsQualifier = (issuesToCheck: Array<string>, isLocalClient = false): Array<string> =>
    issuesToCheck.map((issue) => `${isLocalClient ? "loc" : "rem"}-${issue}`);

function calculateCallQualityScore(
    clientId: string,
    roomMode: RoomMode | null,
    mediaQualityScores: MediaQualityScores | undefined,
    connectionMonitorIssuesReport: ConnectionMonitorReport | undefined,
): CallQualityScore {
    const videoScoreValue = Math.min(
        ...(roomMode === "normal"
            ? [
                  convertQualityScoreToNumber(
                      connectionMonitorIssuesReport?.critical?.[clientId]?.video?.length !== undefined &&
                          connectionMonitorIssuesReport?.critical?.[clientId]?.video?.length > 0
                          ? CALL_QUALITY_LEVELS.CRITICAL
                          : CALL_QUALITY_LEVELS.OK,
                  ),
                  convertQualityScoreToNumber(
                      connectionMonitorIssuesReport?.warning?.[clientId]?.video?.length !== undefined &&
                          connectionMonitorIssuesReport?.warning?.[clientId]?.video?.length > 0
                          ? CALL_QUALITY_LEVELS.WARNING
                          : CALL_QUALITY_LEVELS.OK,
                  ),
              ]
            : [convertQualityScoreToNumber(mediaQualityScores?.[clientId]?.video ?? CALL_QUALITY_LEVELS.OK)]),
    );

    const audioScoreValue = Math.min(
        ...(roomMode === "normal"
            ? [
                  convertQualityScoreToNumber(
                      connectionMonitorIssuesReport?.critical?.[clientId]?.audio?.length !== undefined &&
                          connectionMonitorIssuesReport?.critical?.[clientId]?.audio?.length > 0
                          ? CALL_QUALITY_LEVELS.CRITICAL
                          : CALL_QUALITY_LEVELS.OK,
                  ),
                  convertQualityScoreToNumber(
                      connectionMonitorIssuesReport?.warning?.[clientId]?.audio?.length !== undefined &&
                          connectionMonitorIssuesReport?.warning?.[clientId]?.audio?.length > 0
                          ? CALL_QUALITY_LEVELS.WARNING
                          : CALL_QUALITY_LEVELS.OK,
                  ),
              ]
            : [convertQualityScoreToNumber(mediaQualityScores?.[clientId]?.audio ?? CALL_QUALITY_LEVELS.OK)]),
    );

    const overallScoreValue = Math.min(videoScoreValue, audioScoreValue);

    return {
        total: CALL_QUALITY_LEVEL_ORDER[overallScoreValue],
        video: CALL_QUALITY_LEVEL_ORDER[videoScoreValue],
        audio: CALL_QUALITY_LEVEL_ORDER[audioScoreValue],
    };
}

/**
 * Reducer
 */

export interface ConnectionMonitorStart {
    stopIssueSubscription: () => void;
}

export interface ConnectionMonitorState {
    running: boolean;
    issuesReport?: ConnectionMonitorReport;
    remoteQualityScores?: RemoteCallQualityScores;
    localQualityScore?: CallQualityScore;
    mediaScores?: MediaQualityScores;
    stopCallbackFunction?: () => void;
}

export const connectionMonitorSliceInitialState: ConnectionMonitorState = {
    running: false,
    issuesReport: undefined,
    remoteQualityScores: undefined,
    localQualityScore: undefined,
    mediaScores: undefined,
};

export const connectionMonitorSlice = createSlice({
    name: "connectionMonitor",
    initialState: connectionMonitorSliceInitialState,
    reducers: {
        connectionMonitorStarted: (state, action: PayloadAction<ConnectionMonitorStart>) => {
            return {
                ...state,
                running: true,
                stopCallbackFunction: action.payload.stopIssueSubscription,
            };
        },
        connectionMonitorReportUpdated: (state, action: PayloadAction<ConnectionMonitorReport>) => {
            return {
                ...state,
                issuesReport: action.payload,
            };
        },
        updateRemoteCallQualityScores: (state, action: PayloadAction<RemoteCallQualityScores>) => {
            return {
                ...state,
                remoteQualityScores: action.payload,
            };
        },
        updateLocalCallQualityScore: (state, action: PayloadAction<CallQualityScore>) => {
            return {
                ...state,
                localQualityScore: action.payload,
            };
        },
        connectionMonitorStopped: () => {
            return {
                ...connectionMonitorSliceInitialState,
            };
        },
    },
    extraReducers: (builder) => {
        builder.addCase(rtcEvents.mediaQualityChanged, (state, action) => {
            return {
                ...state,
                mediaScores: {
                    ...state.mediaScores,
                    [action.payload.clientId]: {
                        ...(state.mediaScores?.[action.payload.clientId] || {}),
                        [action.payload.kind]: action.payload.quality,
                    },
                },
            };
        });
    },
});

/**
 * Action creators
 */

export const {
    connectionMonitorStarted,
    connectionMonitorStopped,
    connectionMonitorReportUpdated,
    updateRemoteCallQualityScores,
    updateLocalCallQualityScore,
} = connectionMonitorSlice.actions;

export const doStartConnectionMonitor = createAppThunk(() => (dispatch, getState) => {
    setClientProvider(() => {
        const state = getState();

        const clientViews = selectAllClientViews(state).map((clientView) => ({
            id: clientView.id,
            clientId: clientView.clientId,
            isAudioOnlyModeEnabled: clientView.isAudioOnlyModeEnabled,
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
        onUpdatedIssues: (issuesAndMetricsByClients, _, clients) => {
            // Find critical-level issues
            const clientsWithCriticalIssues = clients.reduce((acc, { clientId, isLocalClient }) => {
                const { issues } = issuesAndMetricsByClients[clientId] || { issues: {} };

                const criticalVideoIssues = getActiveIssues(
                    issues,
                    addMetricsQualifier(
                        ["cam-video-extreme-packetloss", "pres-video-extreme-packetloss"],
                        isLocalClient,
                    ),
                );

                const criticalAudioIssues = getActiveIssues(
                    issues,
                    addMetricsQualifier(["cam-audio-extreme-packetloss"], isLocalClient),
                );

                const criticalCpuIssues = getActiveIssues(issues, ["global-cpu-pressure-critical"]);

                if (
                    criticalVideoIssues.length === 0 &&
                    criticalAudioIssues.length === 0 &&
                    criticalCpuIssues.length === 0
                ) {
                    return acc;
                }

                return {
                    ...acc,
                    [clientId]: {
                        video: criticalVideoIssues,
                        audio: criticalAudioIssues,
                        cpu: criticalCpuIssues,
                    },
                };
            }, {});

            // Find warning-level issues
            const clientsWithWarningIssues = clients.reduce((acc, { clientId, isLocalClient }) => {
                const { issues } = issuesAndMetricsByClients[clientId] || { issues: {} };

                const warningVideoIssues = getActiveIssues(
                    issues,
                    addMetricsQualifier(
                        [
                            "cam-video-bad-network",
                            "pres-video-bad-network",

                            "cam-video-high-packetloss",
                            "pres-video-high-packetloss",

                            "cam-video-low-layer0-bitrate",
                            "pres-video-low-layer0-bitrate",
                        ],
                        isLocalClient,
                    ),
                );

                const warningAudioIssues = getActiveIssues(
                    issues,
                    addMetricsQualifier(
                        ["cam-audio-bad-network", "cam-audio-high-packetloss", "cam-audio-distorted"],
                        isLocalClient,
                    ),
                );

                const warningCpuIssues = getActiveIssues(issues, ["global-cpu-pressure-serious"]);

                if (
                    warningVideoIssues.length === 0 &&
                    warningAudioIssues.length === 0 &&
                    warningCpuIssues.length === 0
                ) {
                    return acc;
                }

                return {
                    ...acc,
                    [clientId]: {
                        video: warningVideoIssues,
                        audio: warningAudioIssues,
                        cpu: warningCpuIssues,
                    },
                };
            }, {});

            const newConnectionMonitorReport = {
                critical: clientsWithCriticalIssues,
                warning: clientsWithWarningIssues,
            };

            dispatch(doUpdateConnectionMonitorReport(newConnectionMonitorReport));

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
            Object.entries(issuesAndMetricsByClients.aggregated.metrics).forEach(([key, value]) => {
                if (/loc.*packetloss/.test(key)) lossSend = Math.max(lossSend, value.curMax);
                if (/rem.*packetloss/.test(key)) lossReceive = Math.max(lossReceive, value.curMax);
                if (/loc.*bitrate/.test(key)) bitrateSend += value.curSum;
                if (/rem.*bitrate/.test(key)) bitrateReceive += value.curSum;
            });

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

export const doUpdateConnectionMonitorReport = createAppThunk(
    (newConnectionMonitorReport: ConnectionMonitorReport) => (dispatch, getState) => {
        const state = getState();

        const rtcManager = selectRtcManager(state);

        if (!rtcManager) {
            return;
        }

        const oldConnectionMonitorReport = selectConnectionMonitorIssuesReport(state);

        if (JSON.stringify(newConnectionMonitorReport) === JSON.stringify(oldConnectionMonitorReport)) {
            return;
        }

        dispatch(connectionMonitorReportUpdated(newConnectionMonitorReport));

        // Prepare and send delta updates of issues to rtcstats, for customer insights
        const localClientId = selectSelfId(state);

        const updatedClientStates: Record<string, { badNetwork: boolean }> = {};

        (["critical", "warning"] as const).forEach((level) => {
            Object.keys(newConnectionMonitorReport[level] || {})
                .filter((clientId) => {
                    const isLocalClientId = clientId === localClientId;
                    return (
                        newConnectionMonitorReport?.[level]?.[clientId]?.video?.includes(
                            addMetricsQualifier(["cam-video-bad-network"], isLocalClientId)[0],
                        ) ||
                        newConnectionMonitorReport?.[level]?.[clientId]?.audio?.includes(
                            addMetricsQualifier(["cam-audio-bad-network"], isLocalClientId)[0],
                        )
                    );
                })
                .forEach((newClientId) => {
                    const oldClient = Object.keys(oldConnectionMonitorReport?.[level] || {}).find(
                        (oldClientId) => oldClientId === newClientId,
                    );
                    if (!oldClient) updatedClientStates[newClientId] = { badNetwork: true };
                });

            Object.keys(oldConnectionMonitorReport?.[level] || {})
                .filter((clientId) => {
                    const isLocalClientId = clientId === localClientId;

                    return (
                        oldConnectionMonitorReport?.[level]?.[clientId]?.video?.includes(
                            addMetricsQualifier(["cam-video-bad-network"], isLocalClientId)[0],
                        ) ||
                        oldConnectionMonitorReport?.[level]?.[clientId]?.audio?.includes(
                            addMetricsQualifier(["cam-audio-bad-network"], isLocalClientId)[0],
                        )
                    );
                })
                .forEach((oldClientId) => {
                    const newClient = Object.keys(newConnectionMonitorReport[level]).find(
                        (newClientId) => newClientId === oldClientId,
                    );
                    if (!newClient) updatedClientStates[oldClientId] = { badNetwork: false };
                });
        });

        if (Object.keys(updatedClientStates).length > 0) {
            rtcManager.sendStatsCustomEvent("clientStates", {
                updatesByClientId: updatedClientStates,
                _time: Date.now(),
            });
        }
    },
);

export const doSetRemoteCallQualityScores = createAppThunk(
    (scores: RemoteCallQualityScores) => (dispatch, getState) => {
        const state = getState();
        const rtcManager = selectRtcManager(state);

        if (!rtcManager) {
            return;
        }

        // Determine total across all remote participants
        const scoreValues = Object.values(scores);
        const total = scoreValues.some(({ total }) => total === CALL_QUALITY_LEVELS.CRITICAL)
            ? CALL_QUALITY_LEVELS.CRITICAL
            : scoreValues.some(({ total }) => total === CALL_QUALITY_LEVELS.WARNING)
              ? CALL_QUALITY_LEVELS.WARNING
              : CALL_QUALITY_LEVELS.OK;

        rtcManager.sendStatsCustomEvent("remoteCallQualityScores", {
            total,
            _time: Date.now(),
        });

        dispatch(updateRemoteCallQualityScores(scores));
    },
);

export const doSetLocalCallQualityScore = createAppThunk((score: CallQualityScore) => (dispatch, getState) => {
    const state = getState();
    const rtcManager = selectRtcManager(state);

    if (!rtcManager) {
        return;
    }

    const oldLocalCallQualityScore = selectLocalCallQualityScore(state);

    if (score.total !== oldLocalCallQualityScore?.total) {
        rtcManager.sendStatsCustomEvent("callQualityScoreTotalChanged", {
            total: score.total,
            _time: Date.now(),
        });
    }

    dispatch(updateLocalCallQualityScore(score));
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
export const selectConnectionMonitorIssuesReport = (state: RootState) => state.connectionMonitor.issuesReport;
export const selectConnectionMediaQualityScores = (state: RootState) => state.connectionMonitor.mediaScores;
export const selectRemoteCallQualityScores = (state: RootState) => state.connectionMonitor.remoteQualityScores;
export const selectLocalCallQualityScore = (state: RootState) => state.connectionMonitor.localQualityScore;

export const selectRemoteParticipantQualityReport = createSelector(
    selectRemoteCallQualityScores,
    (remoteCallQualityScores): RemoteParticipantQualityReport | undefined => {
        if (!remoteCallQualityScores) {
            return undefined;
        }

        return Object.fromEntries(
            Object.entries(remoteCallQualityScores).map(([clientId, { total }]) => [clientId, { quality: total }]),
        );
    },
);

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

export const selectCalculatedRemoteCallQualityScores = createSelector(
    selectRoomConnectionStatus,
    selectRoomMode,
    selectRemoteClientViews,
    selectConnectionMediaQualityScores,
    selectConnectionMonitorIssuesReport,
    (
        roomConnectionStatus,
        roomMode,
        remoteClientViews,
        mediaQualityScores,
        connectionMonitorIssuesReport,
    ): RemoteCallQualityScores | undefined => {
        if (roomConnectionStatus !== "connected") {
            return undefined;
        }

        return Object.fromEntries(
            // The local screenshare is also a remote client view, so leave it out
            remoteClientViews
                .filter(({ isLocalClient }) => !isLocalClient)
                .map(({ clientId }) => [
                    clientId,
                    calculateCallQualityScore(clientId, roomMode, mediaQualityScores, connectionMonitorIssuesReport),
                ]),
        );
    },
);

// Only reported to rtcstats, not exposed in the call quality report
export const selectCalculatedLocalCallQualityScore = createSelector(
    selectRoomConnectionStatus,
    selectRoomMode,
    selectLocalParticipantView,
    selectConnectionMediaQualityScores,
    selectConnectionMonitorIssuesReport,
    (
        roomConnectionStatus,
        roomMode,
        localParticipantView,
        mediaQualityScores,
        connectionMonitorIssuesReport,
    ): CallQualityScore | undefined => {
        if (roomConnectionStatus !== "connected" || !localParticipantView) {
            return undefined;
        }

        return calculateCallQualityScore(
            localParticipantView.clientId,
            roomMode,
            mediaQualityScores,
            connectionMonitorIssuesReport,
        );
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

createReactor(
    [selectCalculatedRemoteCallQualityScores, selectRemoteCallQualityScores],
    ({ dispatch }, newRemoteCallQualityScores, oldRemoteCallQualityScores) => {
        if (!newRemoteCallQualityScores) {
            return;
        }

        if (
            oldRemoteCallQualityScores &&
            JSON.stringify(newRemoteCallQualityScores) === JSON.stringify(oldRemoteCallQualityScores)
        )
            return;

        dispatch(doSetRemoteCallQualityScores(newRemoteCallQualityScores));
    },
);

createReactor(
    [selectCalculatedLocalCallQualityScore, selectLocalCallQualityScore],
    ({ dispatch }, newLocalCallQualityScore, oldLocalCallQualityScore) => {
        if (!newLocalCallQualityScore) {
            return;
        }

        if (
            oldLocalCallQualityScore &&
            JSON.stringify(newLocalCallQualityScore) === JSON.stringify(oldLocalCallQualityScore)
        )
            return;

        dispatch(doSetLocalCallQualityScore(newLocalCallQualityScore));
    },
);
