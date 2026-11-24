import * as localMediaSlice from "../../slices/localMedia";
import { doAppStart, doAppStop, initialState as appInitialState, InitialMuteStates } from "../../slices/app";
import { signalEvents } from "../../slices/signalConnection/actions";
import { createStore, mockRtcManager, mockSignalEmit } from "../store.setup";
import { diff } from "deep-object-diff";
import { PayloadAction } from "@reduxjs/toolkit";

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

const addedCamera = { ...videoDevice, deviceId: "addedVideoDeviceId", label: "Added camera" };
const addedMic = { ...audioDevice, deviceId: "addedAudioDeviceId", label: "Added microphone" };

const createLiveTrack = (kind: "audio" | "video", deviceId: string) => {
    const track: MediaStreamTrack & { readyState: MediaStreamTrackState } = new MockMediaStreamTrack(kind);
    track.readyState = "live";
    track.getSettings = () => ({ deviceId });
    return track;
};

const createLiveStream = () =>
    new MockMediaStream([
        createLiveTrack("audio", audioDevice.deviceId),
        createLiveTrack("video", videoDevice.deviceId),
    ]);

const flushPromises = async () => {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
};

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

const isSettingDevice = (store: ReturnType<typeof createStore>) => {
    const { isSettingCameraDevice, isSettingMicrophoneDevice } = store.getState().localMedia;
    return isSettingCameraDevice || isSettingMicrophoneDevice;
};

const waitForSetDevice = (store: ReturnType<typeof createStore>) =>
    new Promise<void>((resolve) => {
        if (!isSettingDevice(store)) {
            return resolve();
        }
        const unsubscribe = store.subscribe(() => {
            if (!isSettingDevice(store)) {
                unsubscribe();
                resolve();
            }
        });
    });

const waitForToggleCamera = (store: ReturnType<typeof createStore>) =>
    new Promise<void>((resolve) => {
        if (!store.getState().localMedia.isTogglingCamera) {
            return resolve();
        }
        const unsubscribe = store.subscribe(() => {
            if (!store.getState().localMedia.isTogglingCamera) {
                unsubscribe();
                resolve();
            }
        });
    });

const videoModeChanges: [
    string,
    () => PayloadAction<{ enabled?: boolean }>,
    MediaTrackConstraints,
][] = [
    ["HD mode", () => localMediaSlice.toggleHdModeEnabled({ enabled: false }), { height: 360 }],
    ["low data mode", () => localMediaSlice.toggleLowDataModeEnabled({ enabled: true }), { height: 360 }],
    ["widescreen mode", () => localMediaSlice.toggleWidescreenModeEnabled({ enabled: false }), { aspectRatio: 4 / 3 }],
];

const startedLocalMedia = ({
    stream,
    devices,
    ...overrides
}: {
    stream: MediaStream;
    devices: MediaDeviceInfo[];
} & Partial<RootState["localMedia"]>): Partial<RootState> => ({
    localMedia: {
        busyDeviceIds: [],
        cameraPermission: null,
        microphonePermission: null,
        currentCameraDeviceId: videoDevice.deviceId,
        currentMicrophoneDeviceId: audioDevice.deviceId,
        cameraEnabled: true,
        devices,
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
        ...overrides,
    },
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

            it("should NOT call getUserMedia for audio when started without audio", async () => {
                mockedGetUserMedia.mockResolvedValueOnce(
                    new MockMediaStream([createLiveTrack("video", videoDevice.deviceId)]),
                );
                const store = createStore();

                await store.dispatch(localMediaSlice.doStartLocalMedia({ audio: false, video: true }));

                expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
                expect(mockedGetUserMedia).toHaveBeenCalledWith({ video: expect.any(Object) });
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
                        cameraPermission: "granted",
                        microphonePermission: "granted",
                    });
                });
            });

            it("marks only the devices it got a track for as allowed", async () => {
                mockedGetUserMedia.mockResolvedValueOnce(
                    new MockMediaStream([createLiveTrack("video", videoDevice.deviceId)]),
                );
                const store = createStore({
                    initialState: {
                        localMedia: { ...localMediaSlice.initialLocalMediaState, microphonePermission: "denied" },
                    },
                });

                await store.dispatch(localMediaSlice.doStartLocalMedia({ audio: false, video: true }));

                expect(store.getState().localMedia).toEqual(
                    expect.objectContaining({ cameraPermission: "granted", microphonePermission: "denied" }),
                );
            });
        });
    });

    describe("doWatchDevicePermissions", () => {
        class MockPermissionStatus extends EventTarget {
            constructor(public state: PermissionState) {
                super();
            }

            change(state: PermissionState) {
                this.state = state;
                this.dispatchEvent(new Event("change"));
            }
        }

        const mockedQuery = jest.fn();

        const setPermissionsApi = (value: unknown) =>
            Object.defineProperty(navigator, "permissions", { configurable: true, writable: true, value });

        const permissions = (store: ReturnType<typeof createStore>) => {
            const { cameraPermission, microphonePermission } = store.getState().localMedia;
            return { cameraPermission, microphonePermission };
        };

        beforeEach(() => {
            setPermissionsApi({ query: mockedQuery });
        });

        afterEach(() => {
            setPermissionsApi(undefined);
        });

        it("is null until the browser has answered", () => {
            mockedQuery.mockReturnValue(new Promise(() => undefined));
            const store = createStore();

            store.dispatch(localMediaSlice.doWatchDevicePermissions());

            expect(permissions(store)).toEqual({ cameraPermission: null, microphonePermission: null });
        });

        it("reads the camera and microphone permission separately", async () => {
            mockedQuery.mockImplementation(async ({ name }: PermissionDescriptor) =>
                name === "camera" ? new MockPermissionStatus("granted") : new MockPermissionStatus("denied"),
            );
            const store = createStore();

            store.dispatch(localMediaSlice.doWatchDevicePermissions());
            await flushPromises();

            expect(mockedQuery).toHaveBeenCalledWith({ name: "camera" });
            expect(mockedQuery).toHaveBeenCalledWith({ name: "microphone" });
            expect(permissions(store)).toEqual({ cameraPermission: "granted", microphonePermission: "denied" });
        });

        it("follows changes", async () => {
            const camera = new MockPermissionStatus("prompt");
            mockedQuery.mockImplementation(async ({ name }: PermissionDescriptor) =>
                name === "camera" ? camera : new MockPermissionStatus("prompt"),
            );
            const store = createStore();

            store.dispatch(localMediaSlice.doWatchDevicePermissions());
            await flushPromises();
            camera.change("granted");

            expect(permissions(store)).toEqual({ cameraPermission: "granted", microphonePermission: "prompt" });
        });

        it("stops following changes once stopped", async () => {
            const camera = new MockPermissionStatus("prompt");
            mockedQuery.mockImplementation(async ({ name }: PermissionDescriptor) =>
                name === "camera" ? camera : new MockPermissionStatus("prompt"),
            );
            const store = createStore();

            const stop = store.dispatch(localMediaSlice.doWatchDevicePermissions());
            await flushPromises();
            stop();
            camera.change("denied");

            expect(permissions(store).cameraPermission).toEqual("prompt");
        });

        it("ignores an answer that comes after it was stopped", async () => {
            let resolveQuery: (status: MockPermissionStatus) => void = () => undefined;
            mockedQuery.mockReturnValue(
                new Promise((resolve) => {
                    resolveQuery = resolve;
                }),
            );
            const store = createStore();

            const stop = store.dispatch(localMediaSlice.doWatchDevicePermissions());
            stop();
            resolveQuery(new MockPermissionStatus("granted"));
            await flushPromises();

            expect(permissions(store)).toEqual({ cameraPermission: null, microphonePermission: null });
        });

        it.each`
            browser                               | permissionsApi
            ${"has no Permissions API"}           | ${() => undefined}
            ${"rejects the query for the device"} | ${() => ({ query: jest.fn().mockRejectedValue(new TypeError("Unsupported")) })}
        `("reads as not asked yet when the browser $browser", async ({ permissionsApi }) => {
            setPermissionsApi(permissionsApi());
            const store = createStore();

            store.dispatch(localMediaSlice.doWatchDevicePermissions());
            await flushPromises();

            expect(permissions(store)).toEqual({ cameraPermission: "prompt", microphonePermission: "prompt" });
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
                        cameraPermission: null,
                        microphonePermission: null,
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
                        cameraPermission: null,
                        microphonePermission: null,
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
                        cameraPermission: null,
                        microphonePermission: null,
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
                        cameraPermission: null,
                        microphonePermission: null,
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
                        cameraPermission: null,
                        microphonePermission: null,
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
                        cameraPermission: null,
                        microphonePermission: null,
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

    describe("video modes", () => {
        it.each(videoModeChanges)("should not ask for the microphone when %s changes", async (_name, modeChange) => {
            const stream = new MockMediaStream([
                createLiveTrack("audio", audioDevice.deviceId),
                createLiveTrack("video", videoDevice.deviceId),
            ]);
            const store = createStore({
                initialState: startedLocalMedia({ stream, devices: [audioDevice, videoDevice] }),
            });
            mockedGetUserMedia.mockResolvedValueOnce(
                new MockMediaStream([createLiveTrack("video", videoDevice.deviceId)]),
            );

            store.dispatch(modeChange());
            await waitForSwitch(store);

            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
            expect(mockedGetUserMedia).toHaveBeenCalledWith({ video: expect.any(Object) });
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
                        cameraPermission: null,
                        microphonePermission: null,
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
                        cameraPermission: null,
                        microphonePermission: null,
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
            store.dispatch(localMediaSlice.doSwitchLocalStream({ videoId: videoDevice.deviceId }));
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, videoDevice]);

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
        });

        it("should not start a second getUserMedia when a switch starts while devices are read", async () => {
            const otherCamera = { ...videoDevice, deviceId: "otherVideoDeviceId", label: "Other camera" };
            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraPermission: null,
                        microphonePermission: null,
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
            let resolveDevices: (devices: MediaDeviceInfo[]) => void = () => {};
            mockedEnumerateDevices.mockReturnValueOnce(new Promise((resolve) => (resolveDevices = resolve)));
            mockedGetUserMedia.mockReturnValueOnce(new Promise<MediaStream>(() => {}));
            const updatingDeviceList = store.dispatch(localMediaSlice.doUpdateDeviceList());

            store.dispatch(localMediaSlice.doSwitchLocalStream({ videoId: videoDevice.deviceId }));
            resolveDevices([audioDevice, videoDevice]);
            await updatingDeviceList;

            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
        });

        it("should not start getUserMedia when the mic track has ended", async () => {
            const endedMic = createLiveTrack("audio", audioDevice.deviceId);
            endedMic.readyState = "ended";
            const stream = new MockMediaStream([endedMic, createLiveTrack("video", videoDevice.deviceId)]);
            const store = createStore({
                initialState: startedLocalMedia({ stream, devices: [audioDevice, videoDevice] }),
            });
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, videoDevice]);

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            expect(mockedGetUserMedia).not.toHaveBeenCalled();
        });

        it("should not ask for a microphone when the muted one is unplugged", async () => {
            const otherMic = { ...audioDevice, deviceId: "otherAudioDeviceId", label: "Other microphone" };
            const endedMic = createLiveTrack("audio", audioDevice.deviceId);
            endedMic.readyState = "ended";
            const stream = new MockMediaStream([endedMic, createLiveTrack("video", videoDevice.deviceId)]);
            const store = createStore({
                initialState: startedLocalMedia({
                    stream,
                    devices: [audioDevice, otherMic, videoDevice],
                    microphoneEnabled: false,
                }),
            });
            mockedEnumerateDevices.mockResolvedValueOnce([otherMic, videoDevice]);

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            expect(mockedGetUserMedia).not.toHaveBeenCalled();
        });

        it("should switch to an added camera before joining", async () => {
            const newTrack = createLiveTrack("video", addedCamera.deviceId);
            const stream = createLiveStream();
            const store = createStore({
                initialState: startedLocalMedia({ stream, devices: [audioDevice, videoDevice] }),
            });
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, videoDevice, addedCamera]);
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([newTrack]));

            await store.dispatch(localMediaSlice.doUpdateDeviceList());
            await waitForSwitch(store);

            expect(stream.getVideoTracks()).toEqual([newTrack]);
        });

        it("should not switch to an added camera once joined", async () => {
            const store = createStore({
                initialState: startedLocalMedia({ stream: createLiveStream(), devices: [audioDevice, videoDevice] }),
                connectToRoom: true,
            });
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, videoDevice, addedCamera]);

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            expect(mockedGetUserMedia).not.toHaveBeenCalled();
            expect(store.getState().localMedia.currentCameraDeviceId).toBe(videoDevice.deviceId);
        });

        it("should not switch to an added microphone once joined", async () => {
            const store = createStore({
                initialState: startedLocalMedia({ stream: createLiveStream(), devices: [audioDevice, videoDevice] }),
                connectToRoom: true,
            });
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, addedMic, videoDevice]);

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            expect(mockedGetUserMedia).not.toHaveBeenCalled();
            expect(store.getState().localMedia.currentMicrophoneDeviceId).toBe(audioDevice.deviceId);
        });

        it("should not switch to an added camera while rejoining", async () => {
            const store = createStore({
                initialState: {
                    ...startedLocalMedia({ stream: createLiveStream(), devices: [audioDevice, videoDevice] }),
                    roomConnection: {
                        session: null,
                        status: "reconnecting",
                        error: null,
                        knockResponse: null,
                        isRejoining: true,
                    },
                },
            });
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, videoDevice, addedCamera]);

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            expect(mockedGetUserMedia).not.toHaveBeenCalled();
            expect(store.getState().localMedia.currentCameraDeviceId).toBe(videoDevice.deviceId);
        });
    });

    describe("device picks", () => {
        it("should get the picked camera", async () => {
            const otherCamera = { ...videoDevice, deviceId: "otherVideoDeviceId", label: "Other camera" };
            const pickedTrack = createLiveTrack("video", otherCamera.deviceId);
            const stream = new MockMediaStream([
                createLiveTrack("audio", audioDevice.deviceId),
                createLiveTrack("video", videoDevice.deviceId),
            ]);
            const store = createStore({
                initialState: startedLocalMedia({ stream, devices: [audioDevice, videoDevice, otherCamera] }),
            });
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([pickedTrack]));

            store.dispatch(localMediaSlice.setCurrentCameraDeviceId({ deviceId: otherCamera.deviceId }));
            await waitForSetDevice(store);

            const constraints = mockedGetUserMedia.mock.calls[0][0];
            expect(constraints).not.toHaveProperty("audio");
            expect(constraints?.video).toEqual(expect.objectContaining({ deviceId: { exact: otherCamera.deviceId } }));
            expect(stream.getVideoTracks()).toEqual([pickedTrack]);
            expect(store.getState().localMedia.currentCameraDeviceId).toBe(otherCamera.deviceId);
        });

        it("should get the picked microphone", async () => {
            const otherMic = { ...audioDevice, deviceId: "otherAudioDeviceId", label: "Other microphone" };
            const pickedTrack = createLiveTrack("audio", otherMic.deviceId);
            const stream = new MockMediaStream([
                createLiveTrack("audio", audioDevice.deviceId),
                createLiveTrack("video", videoDevice.deviceId),
            ]);
            const store = createStore({
                initialState: startedLocalMedia({ stream, devices: [audioDevice, otherMic, videoDevice] }),
            });
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([pickedTrack]));

            store.dispatch(localMediaSlice.setCurrentMicrophoneDeviceId({ deviceId: otherMic.deviceId }));
            await waitForSetDevice(store);

            const constraints = mockedGetUserMedia.mock.calls[0][0];
            expect(constraints).not.toHaveProperty("video");
            expect(constraints?.audio).toEqual(expect.objectContaining({ deviceId: { exact: otherMic.deviceId } }));
            expect(stream.getAudioTracks()).toEqual([pickedTrack]);
            expect(store.getState().localMedia.currentMicrophoneDeviceId).toBe(otherMic.deviceId);
        });

        it("should show the camera we got when the pick lands on another one", async () => {
            const otherCamera = { ...videoDevice, deviceId: "otherVideoDeviceId", label: "Other camera" };
            const thirdCamera = { ...videoDevice, deviceId: "thirdVideoDeviceId", label: "Third camera" };
            const stream = new MockMediaStream([
                createLiveTrack("audio", audioDevice.deviceId),
                createLiveTrack("video", videoDevice.deviceId),
            ]);
            const store = createStore({
                initialState: startedLocalMedia({
                    stream,
                    devices: [audioDevice, videoDevice, otherCamera, thirdCamera],
                }),
            });
            mockedGetUserMedia.mockResolvedValueOnce(
                new MockMediaStream([createLiveTrack("video", thirdCamera.deviceId)]),
            );

            store.dispatch(localMediaSlice.setCurrentCameraDeviceId({ deviceId: otherCamera.deviceId }));
            await waitForSetDevice(store);

            expect(store.getState().localMedia.currentCameraDeviceId).toBe(thirdCamera.deviceId);
        });

        it("should get a picked microphone when started without one", async () => {
            const pickedTrack = createLiveTrack("audio", audioDevice.deviceId);
            const stream = new MockMediaStream([createLiveTrack("video", videoDevice.deviceId)]);
            const store = createStore({
                initialState: startedLocalMedia({
                    stream,
                    devices: [audioDevice, videoDevice],
                    currentMicrophoneDeviceId: undefined,
                    microphoneEnabled: false,
                }),
            });
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([pickedTrack]));

            store.dispatch(localMediaSlice.setCurrentMicrophoneDeviceId({ deviceId: audioDevice.deviceId }));
            await waitForSetDevice(store);

            const constraints = mockedGetUserMedia.mock.calls[0][0];
            expect(constraints?.audio).toEqual(expect.objectContaining({ deviceId: { exact: audioDevice.deviceId } }));
            expect(stream.getAudioTracks()).toEqual([pickedTrack]);
        });

        it("should hand a picked microphone to the rtc manager when started without one", async () => {
            const pickedTrack = createLiveTrack("audio", audioDevice.deviceId);
            const stream = new MockMediaStream([createLiveTrack("video", videoDevice.deviceId)]);
            const store = createStore({
                withRtcManager: true,
                initialState: startedLocalMedia({
                    stream,
                    devices: [audioDevice, videoDevice],
                    currentMicrophoneDeviceId: undefined,
                    microphoneEnabled: false,
                }),
            });
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([pickedTrack]));

            store.dispatch(localMediaSlice.setCurrentMicrophoneDeviceId({ deviceId: audioDevice.deviceId }));
            await waitForSetDevice(store);

            expect(mockRtcManager.replaceTrack).toHaveBeenCalledTimes(1);
            expect(mockRtcManager.replaceTrack).toHaveBeenCalledWith(null, pickedTrack);
        });

        it("should hand a picked camera to the rtc manager when there was no camera track", async () => {
            const pickedTrack = createLiveTrack("video", videoDevice.deviceId);
            const stream = new MockMediaStream([createLiveTrack("audio", audioDevice.deviceId)]);
            const store = createStore({
                withRtcManager: true,
                initialState: startedLocalMedia({
                    stream,
                    devices: [audioDevice, videoDevice],
                    currentCameraDeviceId: undefined,
                }),
            });
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([pickedTrack]));

            store.dispatch(localMediaSlice.setCurrentCameraDeviceId({ deviceId: videoDevice.deviceId }));
            await waitForSetDevice(store);

            expect(mockRtcManager.replaceTrack).toHaveBeenCalledTimes(1);
            expect(mockRtcManager.replaceTrack).toHaveBeenCalledWith(null, pickedTrack);
        });

        it("should show the camera we hold after a failed pick", async () => {
            const otherCamera = { ...videoDevice, deviceId: "otherVideoDeviceId", label: "Other camera" };
            const stream = new MockMediaStream([
                createLiveTrack("audio", audioDevice.deviceId),
                createLiveTrack("video", videoDevice.deviceId),
            ]);
            const store = createStore({
                initialState: startedLocalMedia({ stream, devices: [audioDevice, videoDevice, otherCamera] }),
            });
            mockedGetUserMedia.mockRejectedValueOnce(new DOMException("Requested device not found", "NotFoundError"));

            store.dispatch(localMediaSlice.setCurrentCameraDeviceId({ deviceId: otherCamera.deviceId }));
            await waitForSetDevice(store);

            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
            expect(store.getState().localMedia.currentCameraDeviceId).toBe(videoDevice.deviceId);
        });
    });

    describe("camera off", () => {
        const ourCamera = { ...videoDevice, deviceId: "ourVideoDeviceId", label: "Our camera" };
        const otherMic = { ...audioDevice, deviceId: "otherAudioDeviceId", label: "Other microphone" };
        const devices = [audioDevice, otherMic, videoDevice, ourCamera];

        const createStoreWithCameraOff = async () => {
            const stream = new MockMediaStream([
                createLiveTrack("audio", audioDevice.deviceId),
                createLiveTrack("video", ourCamera.deviceId),
            ]);
            const store = createStore({
                initialState: startedLocalMedia({ stream, devices, currentCameraDeviceId: ourCamera.deviceId }),
            });
            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: false }));
            await waitForToggleCamera(store);
            return store;
        };

        const turnCameraOn = async (store: ReturnType<typeof createStore>, deviceId: string) => {
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([createLiveTrack("video", deviceId)]));
            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: true }));
            await waitForToggleCamera(store);
        };

        it.each<[string, (store: ReturnType<typeof createStore>) => Promise<void>]>([
            [
                "a camera is plugged in",
                async (store) => {
                    const pluggedInCamera = { ...videoDevice, deviceId: "pluggedInVideoDeviceId", label: "New camera" };
                    mockedEnumerateDevices.mockResolvedValueOnce([...devices, pluggedInCamera]);
                    await store.dispatch(localMediaSlice.doUpdateDeviceList());
                },
            ],
            [
                "a microphone is picked",
                async (store) => {
                    mockedGetUserMedia.mockResolvedValueOnce(
                        new MockMediaStream([createLiveTrack("audio", otherMic.deviceId)]),
                    );
                    store.dispatch(localMediaSlice.setCurrentMicrophoneDeviceId({ deviceId: otherMic.deviceId }));
                    await waitForSetDevice(store);
                },
            ],
        ])("should remember the camera when %s while off", async (_name, trigger) => {
            const store = await createStoreWithCameraOff();
            await trigger(store);
            const cameraWhileOff = store.getState().localMedia.currentCameraDeviceId;
            mockedGetUserMedia.mockClear();

            await turnCameraOn(store, ourCamera.deviceId);

            const constraints = mockedGetUserMedia.mock.calls[0]?.[0];
            expect(cameraWhileOff).toBe(ourCamera.deviceId);
            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
            expect(constraints?.video).toEqual(expect.objectContaining({ deviceId: { exact: ourCamera.deviceId } }));
        });

        it("should remember a camera picked while off", async () => {
            const store = await createStoreWithCameraOff();
            store.dispatch(localMediaSlice.setCurrentCameraDeviceId({ deviceId: videoDevice.deviceId }));
            await waitForSetDevice(store);
            mockedGetUserMedia.mockClear();

            await turnCameraOn(store, videoDevice.deviceId);

            const constraints = mockedGetUserMedia.mock.calls[0]?.[0];
            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
            expect(constraints?.video).toEqual(expect.objectContaining({ deviceId: { exact: videoDevice.deviceId } }));
        });

        it("should forget the camera when it's unplugged while off", async () => {
            const store = await createStoreWithCameraOff();
            mockedEnumerateDevices.mockResolvedValueOnce([audioDevice, otherMic, videoDevice]);
            await store.dispatch(localMediaSlice.doUpdateDeviceList());
            const cameraWhileOff = store.getState().localMedia.currentCameraDeviceId;
            mockedGetUserMedia.mockClear();

            await turnCameraOn(store, videoDevice.deviceId);

            const constraints = mockedGetUserMedia.mock.calls[0]?.[0];
            expect(cameraWhileOff).not.toBe(ourCamera.deviceId);
            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
            expect(constraints?.video).not.toHaveProperty("deviceId");
        });

        it("should get a camera on the next toggle after turning it on fails", async () => {
            const store = await createStoreWithCameraOff();
            mockedGetUserMedia.mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: true }));
            await waitForToggleCamera(store);
            mockedGetUserMedia.mockResolvedValue(new MockMediaStream());
            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: false }));
            await waitForToggleCamera(store);
            mockedGetUserMedia.mockClear();

            await turnCameraOn(store, ourCamera.deviceId);

            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
        });

        it.each(videoModeChanges)("should not ask getUserMedia when %s changes while off", async (_name, modeChange) => {
            const store = await createStoreWithCameraOff();
            mockedGetUserMedia.mockClear();

            store.dispatch(modeChange());
            await waitForSwitch(store);

            expect(mockedGetUserMedia).not.toHaveBeenCalled();
        });

        it.each(videoModeChanges)(
            "should get the %s changed while off when turned on",
            async (_name, modeChange, expectedVideo) => {
                const store = await createStoreWithCameraOff();
                store.dispatch(modeChange());
                await waitForSwitch(store);
                mockedGetUserMedia.mockClear();

                await turnCameraOn(store, ourCamera.deviceId);

                const constraints = mockedGetUserMedia.mock.calls[0]?.[0];
                expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
                expect(constraints?.video).toEqual(expect.objectContaining(expectedVideo));
            },
        );
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
                        cameraPermission: null,
                        microphonePermission: null,
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
