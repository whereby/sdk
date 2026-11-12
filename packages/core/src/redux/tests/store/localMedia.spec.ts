import * as localMediaSlice from "../../slices/localMedia";
import { doAppStart, doAppStop, initialState as appInitialState, InitialMuteStates } from "../../slices/app";
import { signalEvents } from "../../slices/signalConnection/actions";
import { createStore, mockSignalEmit } from "../store.setup";
import { diff } from "deep-object-diff";

import MockMediaStream from "../../../__mocks__/MediaStream";
import MockMediaStreamTrack from "../../../__mocks__/MediaStreamTrack";
import mockMediaDevices from "../../../__mocks__/mediaDevices";
import { RootState } from "../../store";
import { randomString } from "../../../__mocks__/appMocks";

Object.defineProperty(window, "MediaStream", {
    writable: true,
    value: MockMediaStream,
});

Object.defineProperty(window, "MediaStreamTrack", {
    writable: true,
    value: MockMediaStreamTrack,
});

Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    value: mockMediaDevices,
});

const mockedEnumerateDevices = jest.mocked(navigator.mediaDevices.enumerateDevices);
const mockedGetUserMedia = jest.mocked(navigator.mediaDevices.getUserMedia);

const audioDevice = {
    deviceId: "audioDeviceId",
    kind: "audioinput" as const,
    label: "Microphone",
    groupId: "a",
    toJSON: () => ({}),
};
const videoDevice = {
    deviceId: "videoDeviceId",
    kind: "videoinput" as const,
    label: "Camera",
    groupId: "b",
    toJSON: () => ({}),
};

const createLiveTrack = (kind: "audio" | "video", deviceId: string) =>
    Object.assign(new MockMediaStreamTrack(kind), {
        readyState: "live",
        getSettings: () => ({ deviceId }),
    });

const waitForSwitch = (store: ReturnType<typeof createStore>) =>
    new Promise<void>((resolve) => {
        if (!store.getState().localMedia.isSwitchingStream) {
            return resolve();
        }
        const unsubscribe = store.subscribe(() => {
            if (!store.getState().localMedia.isSwitchingStream) {
                unsubscribe();
                resolve();
            }
        });
    });

describe("actions", () => {
    describe("doStartLocalMedia", () => {
        describe("when passed existing stream", () => {
            let existingStream: MediaStream;

            beforeEach(() => {
                existingStream = new MockMediaStream([createLiveTrack("audio", audioDevice.deviceId)]);
            });

            it("should NOT call getUserMedia", async () => {
                const store = createStore();

                await store.dispatch(localMediaSlice.doStartLocalMedia(existingStream));

                expect(mockedGetUserMedia).not.toHaveBeenCalled();
            });

            it("should resolve with existing stream", async () => {
                const store = createStore();

                const before = store.getState().localMedia;

                await store.dispatch(localMediaSlice.doStartLocalMedia(existingStream));

                const after = store.getState().localMedia;

                expect(diff(before, after)).toEqual({
                    status: "started",
                    stream: existingStream,
                    onDeviceChange: expect.any(Function),
                    microphoneEnabled: true,
                    currentCameraDeviceId: null,
                    currentMicrophoneDeviceId: audioDevice.deviceId,
                });
            });
        });

        describe("when passed localMediaOptions", () => {
            beforeEach(() => {
                mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, videoDevice]);
            });

            it("should call getUserMedia for audio and video", async () => {
                mockedGetUserMedia.mockResolvedValueOnce(
                    new MockMediaStream([
                        createLiveTrack("audio", audioDevice.deviceId),
                        createLiveTrack("video", videoDevice.deviceId),
                    ]),
                );
                const store = createStore();

                await store.dispatch(localMediaSlice.doStartLocalMedia({ audio: true, video: true }));

                expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
                expect(mockedGetUserMedia).toHaveBeenCalledWith({
                    audio: expect.any(Object),
                    video: expect.any(Object),
                });
            });

            describe("when getUserMedia succeeds", () => {
                let newStream: MediaStream;

                beforeEach(() => {
                    newStream = new MockMediaStream([
                        createLiveTrack("audio", audioDevice.deviceId),
                        createLiveTrack("video", videoDevice.deviceId),
                    ]);
                    mockedGetUserMedia.mockResolvedValueOnce(newStream);
                });

                it("should update state", async () => {
                    const store = createStore();

                    const before = store.getState().localMedia;

                    await store.dispatch(localMediaSlice.doStartLocalMedia({ audio: true, video: true }));

                    const after = store.getState().localMedia;

                    expect(diff(before, after)).toEqual({
                        status: "started",
                        stream: newStream,
                        devices: expect.any(Object),
                        options: { audio: true, video: true },
                        onDeviceChange: expect.any(Function),
                        cameraEnabled: true,
                        microphoneEnabled: true,
                        currentCameraDeviceId: videoDevice.deviceId,
                        currentMicrophoneDeviceId: audioDevice.deviceId,
                    });
                });
            });
        });
    });

    describe("doStopLocalMedia", () => {
        describe("when existing stream", () => {
            let audioTrack: MediaStreamTrack;
            let videoTrack: MediaStreamTrack;
            let initialState: Partial<RootState>;

            beforeEach(() => {
                audioTrack = new MockMediaStreamTrack("audio");
                videoTrack = new MockMediaStreamTrack("video");

                initialState = {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        devices: [],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream([audioTrack, videoTrack]),
                        widescreenMode: true,
                    },
                };
            });

            it("should stop all tracks in existing stream", () => {
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.doStopLocalMedia());

                expect(audioTrack.stop).toHaveBeenCalled();
                expect(videoTrack.stop).toHaveBeenCalled();
            });

            it('should update state to "stopped"', () => {
                const store = createStore({ initialState });

                const before = store.getState().localMedia;

                store.dispatch(localMediaSlice.doStopLocalMedia());

                const after = store.getState().localMedia;

                expect(diff(before, after)).toEqual({
                    status: "stopped",
                    stream: undefined,
                });
            });

            it("should stop all tracks when the local client is kicked", () => {
                const store = createStore({
                    withSignalConnection: true,
                    connectToRoom: true,
                    initialState: {
                        ...initialState,
                        localMedia: {
                            ...initialState.localMedia!,
                            options: { audio: true, video: true },
                        },
                        app: { ...appInitialState, isActive: true },
                    },
                });

                store.dispatch(signalEvents.clientKicked({ clientId: "self-client-id" }));

                expect(audioTrack.stop).toHaveBeenCalled();
                expect(videoTrack.stop).toHaveBeenCalled();
                expect(store.getState().localMedia.status).toEqual("stopped");
            });
        });
    });

    describe("doToggleCamera", () => {
        describe("when camera is enabled", () => {
            let audioTrack: MediaStreamTrack;
            let initialState: Partial<RootState>;
            let localStream: MediaStream;

            beforeEach(() => {
                audioTrack = new MockMediaStreamTrack("audio");
                localStream = new MockMediaStream([audioTrack]);

                initialState = {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        devices: [audioDevice, videoDevice],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: localStream,
                        widescreenMode: true,
                    },
                };
            });

            it("should get new track and add it to existing stream", async () => {
                const videoTrack = new MockMediaStreamTrack("video");
                mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([videoTrack]));
                const store = createStore({ initialState });

                await store.dispatch(localMediaSlice.doToggleCamera());

                expect(mockedGetUserMedia).toHaveBeenCalledWith({ video: expect.any(Object) });
                expect(localStream.getVideoTracks()).toEqual([videoTrack]);
                expect(localStream.getAudioTracks()).toEqual([audioTrack]);
            });

            it("should dispatch `stopresumevideo` on stream with new video track", async () => {
                const store = createStore({ initialState });
                const videoTrack = new MockMediaStreamTrack("video");
                mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([videoTrack]));

                await store.dispatch(localMediaSlice.doToggleCamera());

                expect(localStream.dispatchEvent).toHaveBeenCalledWith(
                    new CustomEvent("stopresumevideo", { detail: { track: videoTrack, enable: true } }),
                );
            });
        });

        describe("when camera is disabled", () => {
            let audioTrack: MediaStreamTrack;
            let videoTrack: MediaStreamTrack;
            let initialState: Partial<RootState>;
            let localStream: MediaStream;

            beforeEach(() => {
                audioTrack = new MockMediaStreamTrack("audio");
                videoTrack = new MockMediaStreamTrack("video");
                localStream = new MockMediaStream([audioTrack, videoTrack]);

                initialState = {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: false,
                        devices: [],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: localStream,
                        widescreenMode: true,
                    },
                };
            });

            it("should disable video track", () => {
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.doToggleCamera());

                expect(videoTrack.enabled).toBe(false);
            });

            it("should stop video track", async () => {
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.doToggleCamera());

                expect(videoTrack.stop).toHaveBeenCalled();
            });

            it("should remove video track from stream", () => {
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.doToggleCamera());

                expect(localStream.getVideoTracks()).toHaveLength(0);
            });

            it("should dispatch `stopresumevideo` on stream with stopped video track", () => {
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.doToggleCamera());

                expect(localStream.dispatchEvent).toHaveBeenCalledWith(
                    new CustomEvent("stopresumevideo", { detail: { track: videoTrack, enable: false } }),
                );
            });
        });
    });

    describe("toggleHdModeEnabled", () => {
        describe("when video hd mode is disabled", () => {
            let initialState: Partial<RootState>;
            beforeEach(() => {
                initialState = {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        currentCameraDeviceId: videoDevice.deviceId,
                        currentMicrophoneDeviceId: audioDevice.deviceId,
                        devices: [audioDevice, videoDevice],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream(),
                        widescreenMode: true,
                    },
                };
            });

            it("should ask getUserMedia for SD video", () => {
                mockedGetUserMedia.mockResolvedValueOnce(
                    new MockMediaStream([
                        createLiveTrack("audio", audioDevice.deviceId),
                        createLiveTrack("video", videoDevice.deviceId),
                    ]),
                );
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.toggleHdModeEnabled({ enabled: false }));

                expect(mockedGetUserMedia).toHaveBeenCalledWith(
                    expect.objectContaining({ video: expect.objectContaining({ height: 360 }) }),
                );
            });
        });
    });

    describe("toggleLowDataModeEnabled", () => {
        describe("when low data mode is enabled", () => {
            let initialState: Partial<RootState>;
            beforeEach(() => {
                initialState = {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        currentCameraDeviceId: videoDevice.deviceId,
                        currentMicrophoneDeviceId: audioDevice.deviceId,
                        devices: [audioDevice, videoDevice],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream(),
                        widescreenMode: true,
                    },
                };
            });

            it("should ask getUserMedia for low data video", () => {
                mockedGetUserMedia.mockResolvedValueOnce(
                    new MockMediaStream([
                        createLiveTrack("audio", audioDevice.deviceId),
                        createLiveTrack("video", videoDevice.deviceId),
                    ]),
                );
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.toggleLowDataModeEnabled({ enabled: true }));

                expect(mockedGetUserMedia).toHaveBeenCalledWith(
                    expect.objectContaining({ video: expect.objectContaining({ height: 360 }) }),
                );
            });
        });
    });

    describe("toggleWidescreenModeEnabled", () => {
        describe("when video widescreen mode is disabled", () => {
            let initialState: Partial<RootState>;
            beforeEach(() => {
                initialState = {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        currentCameraDeviceId: videoDevice.deviceId,
                        currentMicrophoneDeviceId: audioDevice.deviceId,
                        devices: [audioDevice, videoDevice],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream(),
                        widescreenMode: true,
                    },
                };
            });

            it("should ask getUserMedia for 4:3 video", () => {
                mockedGetUserMedia.mockResolvedValueOnce(
                    new MockMediaStream([
                        createLiveTrack("audio", audioDevice.deviceId),
                        createLiveTrack("video", videoDevice.deviceId),
                    ]),
                );
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.toggleWidescreenModeEnabled({ enabled: false }));

                expect(mockedGetUserMedia).toHaveBeenCalledWith(
                    expect.objectContaining({ video: expect.objectContaining({ aspectRatio: 4 / 3 }) }),
                );
            });
        });
    });

    describe("doUpdateDeviceList", () => {
        it("should switch to another camera if the current camera is unplugged", async () => {
            const dev1 = {
                deviceId: "dev1",
                kind: "videoinput" as const,
                label: randomString("label"),
                groupId: randomString("groupId"),
                toJSON: () => ({}),
            };
            const dev2 = {
                deviceId: "dev2",
                kind: "videoinput" as const,
                label: randomString("label"),
                groupId: randomString("groupId"),
                toJSON: () => ({}),
            };

            const unpluggedTrack = createLiveTrack("video", dev2.deviceId);
            const newTrack = new MockMediaStreamTrack("video");
            const stream = new MockMediaStream([unpluggedTrack]);
            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        currentCameraDeviceId: dev2.deviceId,
                        cameraEnabled: true,
                        devices: [dev1, dev2],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream,
                        widescreenMode: true,
                    },
                },
            });
            mockedEnumerateDevices.mockResolvedValueOnce([dev1]);
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([newTrack]));

            await store.dispatch(localMediaSlice.doUpdateDeviceList());
            await waitForSwitch(store);

            const constraints = mockedGetUserMedia.mock.calls[0][0];
            expect(constraints).not.toHaveProperty("audio");
            expect(constraints?.video).not.toHaveProperty("deviceId");
            expect(stream.getVideoTracks()).toEqual([newTrack]);
            expect(store.getState().localMedia.devices).toEqual([dev1]);
        });

        it("should not start a second getUserMedia while a switch is running", async () => {
            const otherCamera = { ...videoDevice, deviceId: "otherVideoDeviceId", label: "Other camera" };
            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        currentCameraDeviceId: otherCamera.deviceId,
                        currentMicrophoneDeviceId: audioDevice.deviceId,
                        cameraEnabled: true,
                        devices: [audioDevice, videoDevice, otherCamera],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream([
                            createLiveTrack("audio", audioDevice.deviceId),
                            createLiveTrack("video", otherCamera.deviceId),
                        ]),
                        widescreenMode: true,
                    },
                },
            });
            mockedGetUserMedia.mockReturnValueOnce(new Promise<MediaStream>(() => {}));
            store.dispatch(localMediaSlice.toggleHdModeEnabled({ enabled: false }));
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, videoDevice]);

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
        });
    });

    describe("doLocalStreamEffect", () => {
        const createEffectStore = (
            stream: MediaStream,
            beforeEffectTracks?: { audio?: MediaStreamTrack; video?: MediaStreamTrack },
        ) =>
            createStore({
                initialState: {
                    localMedia: {
                        beforeEffectTracks,
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        devices: [],
                        hdMode: true,
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isSwitchingStream: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream,
                        widescreenMode: true,
                    },
                },
            });

        it.each([["audio"], ["video"]])("should put the %s effect track in the stream", async (kind) => {
            const only = kind as "audio" | "video";
            const originalTrack = new MockMediaStreamTrack(only);
            const otherTrack = new MockMediaStreamTrack(only === "audio" ? "video" : "audio");
            const effectTrack = new MockMediaStreamTrack(only);
            const stream = new MockMediaStream([originalTrack, otherTrack]);
            const store = createEffectStore(stream);

            await store.dispatch(
                localMediaSlice.doLocalStreamEffect({ effectStream: new MockMediaStream([effectTrack]), only }),
            );

            expect(stream.getTracks()).toHaveLength(2);
            expect(stream.getTracks()).toContain(effectTrack);
            expect(stream.getTracks()).toContain(otherTrack);
            expect(store.getState().localMedia.beforeEffectTracks?.[only]).toBe(originalTrack);
        });

        it.each([["audio"], ["video"]])("should put the %s track from before the effect back", async (kind) => {
            const only = kind as "audio" | "video";
            const beforeTrack = new MockMediaStreamTrack(only);
            const otherTrack = new MockMediaStreamTrack(only === "audio" ? "video" : "audio");
            const effectTrack = new MockMediaStreamTrack(only);
            const stream = new MockMediaStream([effectTrack, otherTrack]);
            const store = createEffectStore(stream, { [only]: beforeTrack });

            await store.dispatch(localMediaSlice.doLocalStreamEffect({ effectStream: undefined, only }));

            expect(stream.getTracks()).toHaveLength(2);
            expect(stream.getTracks()).toContain(beforeTrack);
            expect(stream.getTracks()).toContain(otherTrack);
            expect(store.getState().localMedia.beforeEffectTracks?.[only]).toBeUndefined();
        });
    });
});

describe("initial mute states", () => {
    const activeApp = (initialMuteStates?: InitialMuteStates) =>
        createStore({
            initialState: { app: { ...appInitialState, isActive: true, initialMuteStates } },
        });

    const acquiredStream = () =>
        new MockMediaStream([new MockMediaStreamTrack("audio"), new MockMediaStreamTrack("video")]);

    it("joins muted once the devices have been acquired", async () => {
        const store = activeApp({ camera: true, microphone: true });

        await store.dispatch(localMediaSlice.doStartLocalMedia(acquiredStream()));

        const { cameraEnabled, microphoneEnabled } = store.getState().localMedia;
        expect(cameraEnabled).toBe(false);
        expect(microphoneEnabled).toBe(false);
    });

    it("leaves omitted devices untouched", async () => {
        const store = activeApp({ camera: true });

        await store.dispatch(localMediaSlice.doStartLocalMedia(acquiredStream()));

        const { cameraEnabled, microphoneEnabled } = store.getState().localMedia;
        expect(cameraEnabled).toBe(false);
        expect(microphoneEnabled).toBe(true);
    });

    it("is applied before the room is joined", async () => {
        const store = createStore({
            withSignalConnection: true,
            initialState: {
                app: {
                    ...appInitialState,
                    isActive: true,
                    roomName: "/test",
                    roomUrl: "https://example.whereby.com/test",
                    initialMuteStates: { camera: true, microphone: true },
                },
                deviceCredentials: {
                    isFetching: false,
                    data: { credentials: { uuid: "uuid" } } as RootState["deviceCredentials"]["data"],
                },
                organization: {
                    isFetching: false,
                    error: null,
                    data: { organizationId: "org" } as RootState["organization"]["data"],
                },
            },
        });

        await store.dispatch(localMediaSlice.doStartLocalMedia(acquiredStream()));

        const joinRoom = mockSignalEmit.mock.calls.find(([event]) => event === "join_room");
        expect(joinRoom?.[1].config).toEqual({ isAudioEnabled: false, isVideoEnabled: false });
    });

    it("does nothing when not configured", async () => {
        const store = activeApp();

        await store.dispatch(localMediaSlice.doStartLocalMedia(acquiredStream()));

        const { cameraEnabled, microphoneEnabled } = store.getState().localMedia;
        expect(cameraEnabled).toBe(true);
        expect(microphoneEnabled).toBe(true);
    });

    it("applies when the app starts after media has been acquired", async () => {
        const store = createStore();

        await store.dispatch(localMediaSlice.doStartLocalMedia(acquiredStream()));
        expect(store.getState().localMedia.cameraEnabled).toBe(true);

        store.dispatch(
            doAppStart({
                displayName: "Test",
                externalId: null,
                initialMuteStates: { camera: true },
                roomKey: null,
                roomUrl: "https://example.whereby.com/test",
            }),
        );

        expect(store.getState().localMedia.cameraEnabled).toBe(false);

        store.dispatch(doAppStop());
    });
});
