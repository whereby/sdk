import * as localMediaSlice from "../../slices/localMedia";
import { createStore } from "../store.setup";
import { diff } from "deep-object-diff";
import * as MediaDevices from "@whereby.com/media";

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

jest.mock("@whereby.com/media", () => ({
    __esModule: true,
    getStream: jest.fn(() => Promise.resolve()),
    getUpdatedDevices: jest.fn(() => Promise.resolve({ addedDevices: {}, changedDevices: {} })),
}));

const mockedGetStream = jest.mocked(MediaDevices.getStream);
const mockedEnumerateDevices = jest.mocked(navigator.mediaDevices.enumerateDevices);

describe("actions", () => {
    describe("doStartLocalMedia", () => {
        describe("when passed existing stream", () => {
            let existingStream: MediaStream;

            beforeEach(() => {
                existingStream = new MockMediaStream();
            });

            it("should NOT get stream", async () => {
                const store = createStore();

                await store.dispatch(localMediaSlice.doStartLocalMedia(existingStream));

                expect(mockedGetStream).toHaveBeenCalledTimes(0);
            });

            it("shuold resolve with existing stream", async () => {
                const store = createStore();

                const before = store.getState().localMedia;

                await store.dispatch(localMediaSlice.doStartLocalMedia(existingStream));

                const after = store.getState().localMedia;

                expect(diff(before, after)).toEqual({
                    status: "started",
                    stream: existingStream,
                    onDeviceChange: expect.any(Function),
                });
            });
        });

        describe("when passed localMediaOptions", () => {
            it("should call getStream", async () => {
                const store = createStore();

                await store.dispatch(localMediaSlice.doStartLocalMedia({ audio: true, video: true }));

                expect(mockedGetStream).toHaveBeenCalledTimes(1);
            });

            describe("when getStream succeeeds", () => {
                let newStream: MediaStream;

                beforeEach(() => {
                    newStream = new MockMediaStream();
                    mockedGetStream.mockResolvedValueOnce({ stream: newStream });
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
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream([audioTrack, videoTrack]),
                        isSwitchingStream: false,
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
                        devices: [],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: localStream,
                        isSwitchingStream: false,
                    },
                };
            });

            it("should get new track and add it to existing stream", () => {
                const store = createStore({ initialState });

                store.dispatch(localMediaSlice.doToggleCamera());

                expect(mockedGetStream).toHaveBeenCalledTimes(1);
            });

            it("should dispatch `stopresumevideo` on stream with new video track", async () => {
                const store = createStore({ initialState });
                const videoTrack = new MockMediaStreamTrack("video");
                mockedGetStream.mockImplementationOnce(async (_, opts) => {
                    if (opts?.replaceStream) {
                        opts.replaceStream.addTrack(videoTrack);
                    }
                    return { stream: opts?.replaceStream || new MockMediaStream([videoTrack]) };
                });

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
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: localStream,
                        isSwitchingStream: false,
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

    describe("doToggleLowDataMode", () => {
        describe("when low data mode is enabled", () => {
            let initialState: Partial<RootState>;
            beforeEach(() => {
                initialState = {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        devices: [],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream(),
                        isSwitchingStream: false,
                    },
                };
            });

            it("should call doSwitchLocalStream", () => {
                jest.spyOn(localMediaSlice, "doSwitchLocalStream");
                const store = createStore({ initialState });
                const before = store.getState().localMedia;

                store.dispatch(localMediaSlice.doToggleLowDataMode());

                expect(localMediaSlice.doSwitchLocalStream).toHaveBeenCalledTimes(1);
                const after = store.getState().localMedia;

                expect(diff(before, after)).toMatchObject({ isSwitchingStream: true });
            });
        });
    });

    describe("doUpdateDeviceList", () => {
        it("should switch to the next video device if current cam is unplugged", async () => {
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

            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        currentCameraDeviceId: dev2.deviceId,
                        cameraEnabled: true,
                        devices: [dev1, dev2],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream(),
                        isSwitchingStream: false,
                    },
                },
            });
            jest.spyOn(localMediaSlice, "doSwitchLocalStream");
            jest.spyOn(MediaDevices, "getUpdatedDevices").mockImplementationOnce(() => ({
                addedDevices: {},
                changedDevices: { videoinput: dev2 },
            }));

            mockedEnumerateDevices.mockImplementationOnce(() => Promise.resolve([dev1]));

            const before = store.getState().localMedia;

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            const after = store.getState().localMedia;

            expect(mockedEnumerateDevices).toHaveBeenCalled();
            expect(localMediaSlice.doSwitchLocalStream).toHaveBeenCalledWith({
                audioId: undefined,
                videoId: dev2.deviceId,
            });
            expect(diff(before, after)).toMatchObject({
                devices: {
                    1: undefined,
                },
            });
        });

        it("should skip busy devices", async () => {
            const videoId = randomString("videoDeviceId");
            const videoId2 = randomString("videoDeviceId2");
            const videoId3 = randomString("videoDeviceId3");

            const dev1 = {
                deviceId: videoId,
                kind: "videoinput" as const,
                label: randomString("label"),
                groupId: randomString("groupId"),
                toJSON: () => ({}),
            };
            const dev2 = {
                deviceId: videoId2,
                kind: "videoinput" as const,
                label: randomString("label"),
                groupId: randomString("groupId"),
                toJSON: () => ({}),
            };
            const dev3 = {
                deviceId: videoId3,
                kind: "videoinput" as const,
                label: randomString("label"),
                groupId: randomString("groupId"),
                toJSON: () => ({}),
            };

            const stream = new MockMediaStream();
            jest.spyOn(MediaDevices, "getStream").mockResolvedValueOnce({ stream });

            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [videoId2],
                        currentCameraDeviceId: videoId,
                        cameraEnabled: true,
                        devices: [dev1, dev2, dev3],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream,
                        isSwitchingStream: false,
                    },
                },
            });
            jest.spyOn(localMediaSlice, "doSwitchLocalStream");
            jest.spyOn(MediaDevices, "getUpdatedDevices").mockImplementationOnce(() => ({
                addedDevices: {},
                changedDevices: { videoinput: dev3 },
            }));

            mockedEnumerateDevices.mockImplementationOnce(() => Promise.resolve([dev1, dev2]));

            const before = store.getState().localMedia;

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            const after = store.getState().localMedia;

            expect(diff(before, after)).toMatchObject({
                busyDeviceIds: {
                    1: expect.any(String),
                },
                devices: {
                    2: undefined,
                },
            });
            expect(localMediaSlice.doSwitchLocalStream).toHaveBeenCalledWith({
                audioId: undefined,
                videoId: videoId3,
            });
            expect(mockedEnumerateDevices).toHaveBeenCalled();
        });
    });
});
