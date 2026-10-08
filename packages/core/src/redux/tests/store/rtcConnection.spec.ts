import { createStore, mockRtcManager } from "../store.setup";
import { RootState } from "../../store";
import {
    audioOnlyModeToggled,
    doHandleAcceptStreams,
    doConnectRtc,
    doDisconnectRtc,
    doRtcReportStreamResolution,
    doRtcManagerInitialize,
    doToggleAudioOnlyMode,
    rtcConnectionSlice,
    rtcConnectionSliceInitialState,
    rtcManagerCreated,
    rtcManagerDestroyed,
    selectRtcManager,
    RtcConnectionState,
} from "../../slices/rtcConnection";
import { randomRemoteParticipant, randomString } from "../../../__mocks__/appMocks";
import MockMediaStream from "../../../__mocks__/MediaStream";
import { CAMERA_STREAM_ID, RtcManagerDispatcher } from "@whereby.com/media";
import { initialLocalMediaState, toggleCameraEnabled } from "../../slices/localMedia";
import { localScreenshareSliceInitialState } from "../../slices/localScreenshare";
import { diff } from "deep-object-diff";
import { coreVersion } from "../../../version";
import { doAppStop } from "../../slices/app";
import { signalEvents } from "../../slices/signalConnection";

jest.mock("@whereby.com/media");

describe("reducers", () => {
    describe("audioOnlyModeToggled", () => {
        it.each`
            current  | enabled      | expected
            ${false} | ${undefined} | ${true}
            ${true}  | ${undefined} | ${false}
            ${false} | ${true}      | ${true}
            ${true}  | ${true}      | ${true}
            ${false} | ${false}     | ${false}
            ${true}  | ${false}     | ${false}
        `(
            "should set isAudioOnlyModeEnabled=$expected when current=$current and enabled=$enabled",
            ({ current, enabled, expected }) => {
                const result = rtcConnectionSlice.reducer(
                    { ...rtcConnectionSliceInitialState, isAudioOnlyModeEnabled: current },
                    audioOnlyModeToggled({ enabled }),
                );

                expect(result.isAudioOnlyModeEnabled).toEqual(expected);
            },
        );
    });

    it("should keep audio-only mode when the rtc manager is destroyed and recreated", () => {
        const initialState = { ...rtcConnectionSliceInitialState, isAudioOnlyModeEnabled: true };

        const destroyed = rtcConnectionSlice.reducer(initialState, rtcManagerDestroyed());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const created = rtcConnectionSlice.reducer(destroyed, rtcManagerCreated({} as any));

        expect(destroyed.isAudioOnlyModeEnabled).toBe(true);
        expect(created.isAudioOnlyModeEnabled).toBe(true);
    });
});

describe("actions", () => {
    it("doHandleAcceptStreams", () => {
        const id1 = randomString("stream1");
        const id2 = randomString("stream2");
        const id3 = randomString("stream3");
        const participant1 = randomRemoteParticipant({ id: "p1", streams: [{ id: id1, state: "to_accept" }] });
        const participant2 = randomRemoteParticipant({
            id: "p2",
            streams: [
                { id: id2, state: "done_accept" },
                { id: id3, state: "to_accept" },
            ],
        });

        const store = createStore({
            withRtcManager: true,
            initialState: {
                remoteParticipants: { remoteParticipants: [participant1, participant2] },
            },
        });

        store.dispatch(
            doHandleAcceptStreams([
                { clientId: participant1.id, streamId: id1, state: "to_accept" },
                { clientId: participant2.id, streamId: id3, state: "to_accept" },
            ]),
        );

        expect(JSON.stringify(mockRtcManager.acceptNewStream.mock.calls)).toStrictEqual(
            JSON.stringify([
                [{ streamId: id1, clientId: participant1.id }],
                [{ streamId: id3, clientId: participant2.id }],
            ]),
        );
        expect(mockRtcManager.acceptNewStream).toHaveBeenCalledTimes(2);
    });

    describe("doConnectRtc", () => {
        it("It initializes the RtcManagerDispatcher", () => {
            const store = createStore({ withSignalConnection: true });

            const before = store.getState().rtcConnection;

            store.dispatch(doConnectRtc());

            const after = store.getState().rtcConnection;

            expect(RtcManagerDispatcher).toHaveBeenCalledTimes(1);
            expect(diff(before, after)).toEqual({
                dispatcherCreated: true,
                rtcManagerDispatcher: expect.any(RtcManagerDispatcher),
            });
        });

        describe("when isNodeSdk is true", () => {
            it("initializes the RtcManagerDispatcher with that feature", () => {
                const store = createStore({
                    withSignalConnection: true,
                    initialState: {
                        app: {
                            displayName: null,
                            externalId: null,
                            ignoreBreakoutGroups: false,
                            isActive: false,
                            isAssistant: false,
                            isAudioRecorder: false,
                            isDialIn: false,
                            isNodeSdk: true,
                            roomName: null,
                            roomUrl: null,
                            userAgent: `core:${coreVersion}`,
                        },
                    },
                });
                const before = store.getState().rtcConnection;

                store.dispatch(doConnectRtc());

                const after = store.getState().rtcConnection;

                expect(RtcManagerDispatcher).toHaveBeenCalledTimes(1);
                expect(RtcManagerDispatcher).toHaveBeenCalledWith(
                    expect.objectContaining({
                        features: expect.objectContaining({ isNodeSdk: true }),
                    }),
                );
                expect(diff(before, after)).toEqual({
                    dispatcherCreated: true,
                    rtcManagerDispatcher: expect.any(RtcManagerDispatcher),
                });
            });
        });
    });

    it("doDisconnectRtc", () => {
        const store = createStore({ withRtcManager: true });

        const before = store.getState().rtcConnection;

        store.dispatch(doDisconnectRtc());

        const after = store.getState().rtcConnection;

        expect(mockRtcManager.disconnectAll).toHaveBeenCalledTimes(1);
        expect(diff(before, after)).toEqual({
            dispatcherCreated: false,
            rtcManager: null,
            rtcManagerDispatcher: null,
            rtcManagerInitialized: false,
            status: "inactive",
        });
    });

    it("doRtcReportStreamResolution", () => {
        const store = createStore({ withRtcManager: true });
        const streamId = randomString("streamId");
        const resolution = { width: 100, height: 100 };

        const before = store.getState().rtcConnection;

        store.dispatch(doRtcReportStreamResolution({ streamId, ...resolution }));

        const after = store.getState().rtcConnection;

        expect(mockRtcManager.updateStreamResolution).toHaveBeenCalledTimes(1);
        expect(mockRtcManager.updateStreamResolution).toHaveBeenCalledWith(streamId, null, resolution);
        expect(diff(before, after)).toEqual({
            reportedStreamResolutions: {
                [streamId]: resolution,
            },
        });
    });

    it("doRtcManagerInitialize", () => {
        const store = createStore({
            withRtcManager: true,
            initialState: {
                localMedia: {
                    ...initialLocalMediaState,
                    stream: new MockMediaStream(),
                },
            },
        });

        store.dispatch(doRtcManagerInitialize());

        expect(mockRtcManager.addCameraStream).toHaveBeenCalledTimes(1);
        expect(mockRtcManager.addCameraStream).toHaveBeenCalledWith(store.getState().localMedia.stream, {
            audioPaused: true,
            videoPaused: true,
        });
        expect(store.getState().rtcConnection.rtcManagerInitialized).toBe(true);
        expect(mockRtcManager.addScreenshareStream).not.toHaveBeenCalled();
    });

    it("doRtcManagerInitialize adds an active local screenshare", () => {
        const screenshareStream = new MockMediaStream();
        const store = createStore({
            withRtcManager: true,
            initialState: {
                localMedia: {
                    ...initialLocalMediaState,
                    stream: new MockMediaStream(),
                },
                localScreenshare: {
                    ...localScreenshareSliceInitialState,
                    status: "active",
                    stream: screenshareStream,
                },
            },
        });

        store.dispatch(doRtcManagerInitialize());

        expect(mockRtcManager.addScreenshareStream).toHaveBeenCalledTimes(1);
        expect(mockRtcManager.addScreenshareStream).toHaveBeenCalledWith(screenshareStream);
    });

    describe("when the rtcManager is recreated", () => {
        it("resets rtcManagerInitialized when the rtcManager is destroyed", () => {
            const store = createStore({ withRtcManager: true });

            store.dispatch(rtcManagerDestroyed());

            expect(store.getState().rtcConnection.rtcManager).toBe(null);
            expect(store.getState().rtcConnection.rtcManagerInitialized).toBe(false);
        });

        it("adds the local camera stream to the new rtcManager", () => {
            const store = createStore({
                withRtcManager: true,
                initialState: {
                    localMedia: {
                        ...initialLocalMediaState,
                        status: "started",
                        stream: new MockMediaStream(),
                    },
                },
            });
            const newRtcManager = { ...mockRtcManager, addCameraStream: jest.fn() };

            store.dispatch(rtcManagerDestroyed());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            store.dispatch(rtcManagerCreated(newRtcManager as any));

            expect(newRtcManager.addCameraStream).toHaveBeenCalledTimes(1);
            expect(newRtcManager.addCameraStream).toHaveBeenCalledWith(store.getState().localMedia.stream, {
                audioPaused: true,
                videoPaused: true,
            });
            expect(store.getState().rtcConnection.rtcManagerInitialized).toBe(true);
        });

        it("adds an active local screenshare to the new rtcManager", () => {
            const screenshareStream = new MockMediaStream();
            const store = createStore({
                withRtcManager: true,
                initialState: {
                    localMedia: {
                        ...initialLocalMediaState,
                        status: "started",
                        stream: new MockMediaStream(),
                    },
                    localScreenshare: {
                        ...localScreenshareSliceInitialState,
                        status: "active",
                        stream: screenshareStream,
                    },
                },
            });
            const newRtcManager = { ...mockRtcManager, addCameraStream: jest.fn(), addScreenshareStream: jest.fn() };

            store.dispatch(rtcManagerDestroyed());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            store.dispatch(rtcManagerCreated(newRtcManager as any));

            expect(newRtcManager.addScreenshareStream).toHaveBeenCalledTimes(1);
            expect(newRtcManager.addScreenshareStream).toHaveBeenCalledWith(screenshareStream);
        });
    });

    describe("doAcceptStreams", () => {
        it("should unaccept camera stream in SFU breakout groups", () => {
            const remoteClientId = randomString();
            const store = createStore({
                withRtcManager: true,
                initialState: {
                    remoteParticipants: {
                        remoteParticipants: [
                            {
                                id: remoteClientId,
                                streams: [{ id: CAMERA_STREAM_ID, state: "done_accept" }],
                                breakoutGroup: "a",
                                deviceId: "",
                                displayName: "",
                                externalId: null,
                                isAudioEnabled: false,
                                isAudioRecorder: false,
                                isDialIn: false,
                                isLocalParticipant: false,
                                isVideoEnabled: false,
                                newJoiner: false,
                                presentationStream: null,
                                roleName: "none",
                                stream: null,
                            },
                        ],
                    },
                },
            });
            const before = store.getState().remoteParticipants;

            store.dispatch(
                doHandleAcceptStreams([{ clientId: remoteClientId, streamId: CAMERA_STREAM_ID, state: "to_unaccept" }]),
            );

            const after = store.getState().remoteParticipants;

            expect(mockRtcManager.disconnect).toHaveBeenCalledTimes(1);
            expect(mockRtcManager.disconnect).toHaveBeenCalledWith(remoteClientId);
            expect(diff(before, after)).toEqual({
                remoteParticipants: {
                    "0": {
                        streams: {
                            "0": {
                                state: "done_unaccept",
                            },
                        },
                    },
                },
            });
        });

        it("should unaccept screenshare stream in SFU breakout groups", () => {
            const remoteClientId = randomString();
            const screenshareStreamId = randomString();
            const store = createStore({
                withRtcManager: true,
                initialState: {
                    remoteParticipants: {
                        remoteParticipants: [
                            {
                                id: remoteClientId,
                                streams: [{ id: screenshareStreamId, state: "done_accept" }],
                                breakoutGroup: "a",
                                deviceId: "",
                                displayName: "",
                                externalId: null,
                                isAudioEnabled: false,
                                isAudioRecorder: false,
                                isDialIn: false,
                                isLocalParticipant: false,
                                isVideoEnabled: false,
                                newJoiner: false,
                                presentationStream: null,
                                roleName: "none",
                                stream: null,
                            },
                        ],
                    },
                },
            });
            const before = store.getState().remoteParticipants;

            store.dispatch(
                doHandleAcceptStreams([
                    { clientId: remoteClientId, streamId: screenshareStreamId, state: "to_unaccept" },
                ]),
            );

            const after = store.getState().remoteParticipants;

            expect(mockRtcManager.disconnect).not.toHaveBeenCalled();
            expect(diff(before, after)).toEqual({
                remoteParticipants: {
                    "0": {
                        streams: {
                            "0": {
                                state: "done_unaccept",
                            },
                        },
                    },
                },
            });
        });
    });

    describe("doToggleAudioOnlyMode", () => {
        const createState = ({
            isAudioOnlyModeEnabled,
            cameraEnabled,
        }: {
            isAudioOnlyModeEnabled: boolean;
            cameraEnabled: boolean;
        }) =>
            ({
                rtcConnection: { ...rtcConnectionSliceInitialState, isAudioOnlyModeEnabled },
                localMedia: { cameraEnabled },
            }) as unknown as RootState;

        it.each`
            enabled  | autoDisableLocalCamera | cameraEnabled | shouldDisableCamera
            ${true}  | ${true}                | ${true}       | ${true}
            ${true}  | ${true}                | ${false}      | ${false}
            ${true}  | ${false}               | ${true}       | ${false}
            ${true}  | ${undefined}           | ${true}       | ${false}
            ${false} | ${true}                | ${true}       | ${false}
        `(
            "should disable camera=$shouldDisableCamera when enabled=$enabled, autoDisableLocalCamera=$autoDisableLocalCamera, cameraEnabled=$cameraEnabled",
            ({ enabled, autoDisableLocalCamera, cameraEnabled, shouldDisableCamera }) => {
                const dispatch = jest.fn();
                const getState = () => createState({ isAudioOnlyModeEnabled: enabled, cameraEnabled });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                doToggleAudioOnlyMode({ enabled, autoDisableLocalCamera })(dispatch, getState, {} as any);

                expect(dispatch).toHaveBeenCalledWith(audioOnlyModeToggled({ enabled }));
                if (shouldDisableCamera) {
                    expect(dispatch).toHaveBeenCalledWith(toggleCameraEnabled({ enabled: false }));
                } else {
                    expect(dispatch).not.toHaveBeenCalledWith(toggleCameraEnabled({ enabled: false }));
                }
            },
        );
    });
});

describe("middleware", () => {
    // Merged over the `withRtcManager` defaults in createStore
    const audioOnlyModeEnabledState = { isAudioOnlyModeEnabled: true } as RtcConnectionState;

    describe("doToggleAudioOnlyMode", () => {
        it("enables audio-only mode on the rtc manager", () => {
            const store = createStore({ withRtcManager: true });

            store.dispatch(doToggleAudioOnlyMode({ enabled: true }));

            expect(store.getState().rtcConnection.isAudioOnlyModeEnabled).toBe(true);
            expect(mockRtcManager.setAudioOnly).toHaveBeenCalledWith(true);
        });

        it("disables audio-only mode on the rtc manager", () => {
            const store = createStore({
                withRtcManager: true,
                initialState: { rtcConnection: audioOnlyModeEnabledState },
            });

            store.dispatch(doToggleAudioOnlyMode({ enabled: false }));

            expect(store.getState().rtcConnection.isAudioOnlyModeEnabled).toBe(false);
            expect(mockRtcManager.setAudioOnly).toHaveBeenCalledWith(false);
        });

        it("turns off the local camera when autoDisableLocalCamera is set", () => {
            const store = createStore({
                withRtcManager: true,
                initialState: { localMedia: { ...initialLocalMediaState, cameraEnabled: true } },
            });

            store.dispatch(doToggleAudioOnlyMode({ enabled: true, autoDisableLocalCamera: true }));

            expect(store.getState().localMedia.cameraEnabled).toBe(false);
        });

        it("does not turn the local camera back on when audio-only mode is disabled", () => {
            const store = createStore({
                withRtcManager: true,
                initialState: {
                    rtcConnection: audioOnlyModeEnabledState,
                    localMedia: { ...initialLocalMediaState, cameraEnabled: false },
                },
            });

            store.dispatch(doToggleAudioOnlyMode({ enabled: false, autoDisableLocalCamera: true }));

            expect(store.getState().localMedia.cameraEnabled).toBe(false);
        });
    });

    describe("rtcManagerCreated", () => {
        it("re-applies audio-only mode to a new rtc manager", () => {
            const store = createStore({
                withRtcManager: true,
                initialState: { rtcConnection: audioOnlyModeEnabledState },
            });
            const newRtcManager = { ...mockRtcManager, setAudioOnly: jest.fn() };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            store.dispatch(rtcManagerCreated(newRtcManager as any));

            expect(newRtcManager.setAudioOnly).toHaveBeenCalledWith(true);
        });

        it("does not touch audio-only mode on a new rtc manager when disabled", () => {
            const store = createStore({ withRtcManager: true });
            const newRtcManager = { ...mockRtcManager, setAudioOnly: jest.fn() };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            store.dispatch(rtcManagerCreated(newRtcManager as any));

            expect(newRtcManager.setAudioOnly).not.toHaveBeenCalled();
        });
    });

    describe("doAppStop", () => {
        it("closes the rtcstats connection", () => {
            const store = createStore({
                withRtcManager: true,
            });
            const rtcManager = selectRtcManager(store.getState());

            store.dispatch(doAppStop());

            expect(rtcManager?.rtcStatsDisconnect).toHaveBeenCalled();
        });
    });

    describe("signalEvents.clientLeft", () => {
        it("it emits the leaving client's event claim", () => {
            const store = createStore({
                withRtcManager: true,
            });
            const rtcManager = selectRtcManager(store.getState());
            const clientId = randomString();
            const eventClaim = randomString();
            store.dispatch(signalEvents.clientLeft({ clientId, eventClaim }));

            expect(rtcManager?.disconnect).toHaveBeenCalledWith(clientId, eventClaim);
        });
    });
});
