import { createStore, mockRtcManager } from "../store.setup";
import {
    doHandleAcceptStreams,
    doConnectRtc,
    doDisconnectRtc,
    doRtcReportStreamResolution,
    doRtcManagerInitialize,
    selectRtcManager,
    rtcManagerCreated,
} from "../../slices/rtcConnection";
import { randomRemoteParticipant, randomSignalClient, randomString } from "../../../__mocks__/appMocks";
import MockMediaStream from "../../../__mocks__/MediaStream";
import { RoleName, RtcManagerDispatcher } from "@whereby.com/media";
import { initialLocalMediaState } from "../../slices/localMedia";
import { diff } from "deep-object-diff";
import { coreVersion } from "../../../version";
import { doAppStop, initialState } from "../../slices/app";
import { signalEvents } from "../../slices/signalConnection";

jest.mock("@whereby.com/media");

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

        expect(JSON.stringify((mockRtcManager.acceptNewStream as jest.Mock).mock.calls)).toStrictEqual(
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
    });
});

describe("middleware", () => {
    describe("on NEW_CLIENT signal events", () => {
        describe("headless audio processing clients", () => {
            it.each([
                "visitor",
                "granted_visitor",
                "viewer",
                "granted_viewer",
                "host",
                "recorder",
                "streamer",
                "assistant",
            ])("Does not update the rtcManager remote client prefs for a %s client", (roleName) => {
                const store = createStore({
                    withRtcManager: true,
                    connectToRoom: true,
                });
                const rtcManager = selectRtcManager(store.getState());
                if (!rtcManager) {
                    throw new Error("No rtcManager");
                }

                store.dispatch(
                    signalEvents.newClient({
                        client: randomSignalClient({ role: { roleName: roleName as RoleName } }),
                    }),
                );

                expect(rtcManager?.setRemoteClientMediaPrefs).not.toHaveBeenCalled();
            });

            it.each`
                kind                       | client
                ${"dial-in"}               | ${randomSignalClient({ isDialIn: true })}
                ${"audio-recorder"}        | ${randomSignalClient({ isAudioRecorder: true })}
                ${"captioner/transcriber"} | ${randomSignalClient({ role: { roleName: "captioner" } })}
            `("tells the rtcManager about $kind client media prefs", ({ client }) => {
                const store = createStore({
                    withRtcManager: true,
                    connectToRoom: true,
                });
                const rtcManager = selectRtcManager(store.getState());
                if (!rtcManager) {
                    throw new Error("No rtcManager");
                }

                store.dispatch(signalEvents.newClient({ client }));

                expect(rtcManager.setRemoteClientMediaPrefs).toHaveBeenCalledWith(client.id, {
                    wantsVideo: false,
                });
            });
        });
    });

    describe("when the RtcManager is created", () => {
        it("updates the rtcManager remote client media prefs for headless audio processing clients", async () => {
            const dialInClient = randomRemoteParticipant({ isDialIn: true });
            const audioRecorderClient = randomRemoteParticipant({
                isAudioRecorder: true,
                roleName: "recorder",
            });
            const captionerClient = randomRemoteParticipant({ roleName: "captioner" });
            const viewerClient = randomRemoteParticipant({ roleName: "granted_viewer" });
            const visitorClient = randomRemoteParticipant({ roleName: "granted_visitor" });
            const hostClient = randomRemoteParticipant({ roleName: "host" });
            const recorderClient = randomRemoteParticipant({ roleName: "recorder" });
            const streamerClient = randomRemoteParticipant({ roleName: "streamer" });
            const assistantClient = randomRemoteParticipant({ roleName: "streamer" });
            const store = createStore({
                initialState: {
                    app: {
                        ...initialState,
                        isActive: true,
                    },
                    remoteParticipants: {
                        remoteParticipants: [
                            dialInClient,
                            audioRecorderClient,
                            captionerClient,
                            visitorClient,
                            viewerClient,
                            hostClient,
                            recorderClient,
                            streamerClient,
                            assistantClient,
                        ],
                    },
                },
            });

            store.dispatch(rtcManagerCreated(mockRtcManager));
            await jest.runAllTimersAsync();

            expect(mockRtcManager.setRemoteClientMediaPrefs).toHaveBeenCalledWith(dialInClient.id, {
                wantsVideo: false,
            });
            expect(mockRtcManager.setRemoteClientMediaPrefs).toHaveBeenCalledWith(captionerClient.id, {
                wantsVideo: false,
            });
            expect(mockRtcManager.setRemoteClientMediaPrefs).toHaveBeenCalledWith(audioRecorderClient.id, {
                wantsVideo: false,
            });
        });
    });

    describe("on CLIENT_LEFT signal events", () => {
        describe("headless audio processing clients", () => {
            it.each([
                "visitor",
                "granted_visitor",
                "viewer",
                "granted_viewer",
                "host",
                "recorder",
                "streamer",
                "assistant",
            ])("does not remove the remote client media prefs for a %s client", (roleName) => {
                const client = randomRemoteParticipant({ roleName: roleName as RoleName });
                const store = createStore({
                    withRtcManager: true,
                    connectToRoom: true,
                    initialState: { remoteParticipants: { remoteParticipants: [client] } },
                });
                const rtcManager = selectRtcManager(store.getState());
                if (!rtcManager) {
                    throw new Error("No rtcManager");
                }

                store.dispatch(
                    signalEvents.clientLeft({
                        clientId: client.id,
                    }),
                );

                expect(rtcManager.removeRemoteClientMediaPrefs).not.toHaveBeenCalled();
            });

            it.each`
                kind                       | client
                ${"audio-recorder"}        | ${randomRemoteParticipant({ isAudioRecorder: true })}
                ${"dial-in"}               | ${randomRemoteParticipant({ isDialIn: true })}
                ${"captioner/transcriber"} | ${randomRemoteParticipant({ roleName: "captioner" })}
            `("removes the remote client media pref from the rtcManager", ({ client }) => {
                const store = createStore({
                    withRtcManager: true,
                    connectToRoom: true,
                    initialState: { remoteParticipants: { remoteParticipants: [client] } },
                });
                const rtcManager = selectRtcManager(store.getState());
                if (!rtcManager) {
                    throw new Error("No rtcManager");
                }

                store.dispatch(
                    signalEvents.clientLeft({
                        clientId: client.id,
                    }),
                );

                expect(rtcManager.removeRemoteClientMediaPrefs).toHaveBeenCalledWith(client.id);
            });
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
});
