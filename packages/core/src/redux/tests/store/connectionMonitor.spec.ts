import { createStore, mockRtcManager } from "../store.setup";
import { randomLocalParticipant, randomRemoteParticipant } from "../../../__mocks__/appMocks";
import {
    doStartConnectionMonitor,
    doStopConnectionMonitor,
    selectCallQualityScores,
} from "../../slices/connectionMonitor";
import { rtcEvents } from "../../slices/rtcConnection/actions";
import { signalEvents } from "../../slices/signalConnection/actions";
import { roomSliceInitialState } from "../../slices/room";
import { setClientProvider, subscribeIssues } from "@whereby.com/media";

jest.mock("@whereby.com/media", () => {
    return {
        __esModule: true,
        ...jest.requireActual("@whereby.com/media"),
        setClientProvider: jest.fn(),
        subscribeIssues: jest.fn().mockImplementation(() => {
            return {
                stop: jest.fn(),
            };
        }),
    };
});

const LOCAL_ID = "local-1";
const REMOTE_ID = "remote-1";

function createConnectedStore(mode: "normal" | "group") {
    return createStore({
        initialState: {
            room: { ...roomSliceInitialState, mode },
            localParticipant: randomLocalParticipant({ id: LOCAL_ID }),
            remoteParticipants: {
                remoteParticipants: [randomRemoteParticipant({ id: REMOTE_ID })],
            },
        },
        withRtcManager: true,
        connectToRoom: true,
    });
}

const activeIssue = { active: true, ticks: 3, registered: 3 };

describe("connectionMonitorSlice", () => {
    describe("actions", () => {
        it("doStartConnectionMonitor", () => {
            const store = createStore();

            store.dispatch(doStartConnectionMonitor());

            const after = store.getState().connectionMonitor;

            expect(setClientProvider).toHaveBeenCalledTimes(1);
            expect(subscribeIssues).toHaveBeenCalledTimes(1);

            expect(after.stopCallbackFunction).not.toHaveBeenCalled();
        });

        it("doStopConnectionMonitor", () => {
            const mockStopIssueSubscription = jest.fn();

            const store = createStore({
                initialState: {
                    connectionMonitor: {
                        running: true,
                        stopCallbackFunction: mockStopIssueSubscription,
                    },
                },
            });

            store.dispatch(doStopConnectionMonitor());

            expect(mockStopIssueSubscription).toHaveBeenCalledTimes(1);
        });
    });

    describe("call quality scores", () => {
        describe("in a group room", () => {
            it("scores each client from SFU media quality, with total as the worst of video and audio", () => {
                const store = createConnectedStore("group");

                store.dispatch(
                    rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "video", quality: "warning" }),
                );
                store.dispatch(
                    rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "audio", quality: "critical" }),
                );

                expect(selectCallQualityScores(store.getState())).toEqual({
                    [LOCAL_ID]: { total: "ok", video: "ok", audio: "ok" },
                    [REMOTE_ID]: { total: "critical", video: "warning", audio: "critical" },
                });
                expect(mockRtcManager.sendStatsCustomEvent).toHaveBeenCalledWith(
                    "remoteCallQualityScores",
                    expect.objectContaining({ total: "critical" }),
                );
            });

            it("keeps the same scores reference when a scoring pass produces identical scores", () => {
                const store = createConnectedStore("group");

                store.dispatch(
                    rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "video", quality: "warning" }),
                );
                const scores = selectCallQualityScores(store.getState());

                // Changes mediaScores (so the reactor runs again) without changing the resulting scores
                store.dispatch(rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "audio", quality: "ok" }));

                expect(selectCallQualityScores(store.getState())).toBe(scores);
            });
        });

        describe("in a normal room", () => {
            it("scores each client from the issue monitor report", () => {
                const store = createConnectedStore("normal");
                store.dispatch(doStartConnectionMonitor());

                const { onUpdatedIssues } = (subscribeIssues as jest.Mock).mock.calls[0][0];
                onUpdatedIssues(
                    {
                        [LOCAL_ID]: { issues: {} },
                        [REMOTE_ID]: {
                            issues: {
                                "rem-cam-video-extreme-packetloss": activeIssue,
                                "rem-cam-audio-high-packetloss": activeIssue,
                            },
                        },
                        aggregated: { metrics: {} },
                    },
                    undefined,
                    [
                        { clientId: LOCAL_ID, isLocalClient: true },
                        { clientId: REMOTE_ID, isLocalClient: false },
                    ],
                );

                expect(selectCallQualityScores(store.getState())).toEqual({
                    [LOCAL_ID]: { total: "ok", video: "ok", audio: "ok" },
                    [REMOTE_ID]: { total: "critical", video: "critical", audio: "warning" },
                });
            });
        });

        it("resets the scores after leaving the room", () => {
            const store = createConnectedStore("group");
            store.dispatch(doStartConnectionMonitor());

            store.dispatch(rtcEvents.mediaQualityChanged({ clientId: REMOTE_ID, kind: "video", quality: "warning" }));
            expect(selectCallQualityScores(store.getState())).toBeDefined();

            store.dispatch(signalEvents.roomLeft());

            expect(selectCallQualityScores(store.getState())).toBeUndefined();
        });
    });
});
