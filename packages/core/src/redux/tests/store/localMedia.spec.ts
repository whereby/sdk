import * as localMediaSlice from "../../slices/localMedia";
import { createStore } from "../store.setup";
import { diff } from "deep-object-diff";
import * as MediaDevices from "@whereby.com/media";

import MockMediaStream from "../../../__mocks__/MediaStream";
import MockMediaStreamTrack from "../../../__mocks__/MediaStreamTrack";
import { RootState } from "../../store";
import { createMockedMediaDevice, mockMediaDevices } from "../../../__mocks__/mediaDevices";

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

describe("actions", () => {
    beforeEach(() => {
        jest.spyOn(MediaDevices, "getStream")
        jest.spyOn(MediaDevices, "getUpdatedDevices")
        jest.spyOn(localMediaSlice, "doSetDevice")
    })

    describe("doStartLocalMedia", () => {
        describe("when passed existing stream", () => {
            let existingStream: MediaStream;

            beforeEach(() => {
                existingStream = new MockMediaStream();
            });

            it("should NOT get stream", async () => {
                const store = createStore();

                await store.dispatch(localMediaSlice.doStartLocalMedia(existingStream));

                expect(MediaDevices.getStream).toHaveBeenCalledTimes(0);
                expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled();
            });

            it("should resolve with existing stream", async () => {
                const store = createStore();

                const before = store.getState().localMedia;

                await store.dispatch(localMediaSlice.doStartLocalMedia(existingStream));

                const after = store.getState().localMedia;

                expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled();
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

                expect(MediaDevices.getStream).toHaveBeenCalledTimes(1);
                expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled();
            });

            describe("when getStream succeeeds", () => {
                let newStream: MediaStream;

                beforeEach(() => {
                    newStream = new MockMediaStream();
                    jest.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(newStream)
                });

                it("should update state", async () => {
                    const store = createStore();

                    const before = store.getState().localMedia;

                    await store.dispatch(localMediaSlice.doStartLocalMedia({ audio: true, video: true }));

                    const after = store.getState().localMedia;

                    expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled();
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
                        isSettingSpeakerDevice: false,
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
                        devices: [createMockedMediaDevice("videoinput")],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
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

                expect(MediaDevices.getStream).toHaveBeenCalledTimes(1);
                expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled();
            });

            it("should dispatch `stopresumevideo` on stream with new video track", async () => {
                const store = createStore({ initialState });
                const videoTrack = new MockMediaStreamTrack("video");
                jest.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(new MockMediaStream([videoTrack]))

                await store.dispatch(localMediaSlice.doToggleCamera());

                expect(MediaDevices.getStream).toHaveBeenCalledTimes(1);
                expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled();
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
                        isSettingSpeakerDevice: false,
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
                        isSettingSpeakerDevice: false,
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
                expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled();
                expect(diff(before, after)).toMatchObject({ isSwitchingStream: true });
            });
        });
    });

    describe("doSwitchLocalStream", () => {
        it("should switch to the next audio device if current mic is unplugged", async () => {
            const aDev1 = createMockedMediaDevice("audioinput")
            const aDev2 = createMockedMediaDevice("audioinput")
            const vDev1 = createMockedMediaDevice("videoinput")
            const vDev2 = createMockedMediaDevice("videoinput")

            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        currentMicrophoneDeviceId: aDev1.deviceId,
                        currentCameraDeviceId: vDev1.deviceId,
                        cameraEnabled: false,
                        devices: [aDev2, vDev2],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream: new MockMediaStream([new MockMediaStreamTrack("audio"), new MockMediaStreamTrack("video")]),
                        isSwitchingStream: false,
                    },
                },
            });
            jest.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(new MockMediaStream([new MockMediaStreamTrack("audio"), new MockMediaStreamTrack("video")]))

            await store.dispatch(localMediaSlice.doSwitchLocalStream({ videoId: true, audioId: true}));

            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
            expect(localMediaSlice.doSetDevice).not.toHaveBeenCalled()
            expect(MediaDevices.getStream).toHaveBeenCalledWith({
                videoId: true,
                audioId: true,
                devices: [aDev2, vDev2],
                options: expect.any(Object),
                type: "exact",
            }, expect.any(Object));
        });
    })

    describe("doUpdateDeviceList", () => {
        it("should switch to the next video device if current cam is unplugged", async () => {
            const dev1 = createMockedMediaDevice("videoinput")
            const dev2 = createMockedMediaDevice("videoinput")

            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        currentCameraDeviceId: dev1.deviceId,
                        cameraEnabled: true,
                        devices: [dev1, dev2],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: false,
                        status: "started",
                        stream: new MockMediaStream(),
                        isSwitchingStream: false,
                    },
                },
            });
            jest.spyOn(localMediaSlice, "doSwitchLocalStream");
            mockedEnumerateDevices.mockImplementationOnce(() => Promise.resolve([dev2]));

            const before = store.getState().localMedia;

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            const after = store.getState().localMedia;

            expect(mockedEnumerateDevices).toHaveBeenCalled();
            expect(localMediaSlice.doSwitchLocalStream).toHaveBeenCalledWith({
                videoId: true,
            });
            expect(diff(before, after)).toMatchObject({
                devices: {
                    1: undefined,
                },
            });
        });
        
        it("should switch to the next audio device if current mic is unplugged", async () => {
            const dev1 = createMockedMediaDevice("audioinput")
            const dev2 = createMockedMediaDevice("audioinput")

            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        currentMicrophoneDeviceId: dev1.deviceId,
                        cameraEnabled: false,
                        devices: [dev1, dev2],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
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
            mockedEnumerateDevices.mockImplementationOnce(() => Promise.resolve([dev2]));

            const before = store.getState().localMedia;

            await store.dispatch(localMediaSlice.doUpdateDeviceList());

            const after = store.getState().localMedia;

            jest.advanceTimersToNextTimerAsync()

            expect(mockedEnumerateDevices).toHaveBeenCalled();
            expect(localMediaSlice.doSwitchLocalStream).toHaveBeenCalledWith({
                audioId: true,
            });
            expect(diff(before, after)).toMatchObject({
                devices: {
                    1: undefined,
                },
            });
        });
    });

    describe("doLocalStreamEffect", () => {
        it.each([["audio"], ["video"]])("basic %s", async (kind) => {
            const getTracks = kind === "audio" ? "getAudioTracks" : "getVideoTracks";
            const getOtherTracks = kind === "audio" ? "getVideoTracks" : "getAudioTracks";
            const stream = new MockMediaStream();

            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        devices: [],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream,
                        isSwitchingStream: false,
                    },
                },
            });
            const effectStream = new MockMediaStream();
            await store.dispatch(
                localMediaSlice.doLocalStreamEffect({ effectStream, only: kind as "audio" | "video" }),
            );
            const effectedStreamSelectedTracks = effectStream[getTracks]();
            const originalStreamReplacedTracks = stream[getTracks]();
            const effectedStreamNotSelectedTracks = effectStream[getOtherTracks]();
            const originalStreamIntactTracks = stream[getOtherTracks]();

            originalStreamReplacedTracks.forEach((effectedTrack) => {
                const replaced = effectedStreamSelectedTracks.filter(
                    (selectedTrack) => selectedTrack.id === effectedTrack.id,
                );
                expect(replaced.length).toEqual(1);
            });

            originalStreamIntactTracks.forEach((intactTrack) => {
                const replaced = effectedStreamNotSelectedTracks.filter(
                    (notSelectedTrack) => notSelectedTrack.id === intactTrack.id,
                );
                expect(replaced.length).toEqual(0);
            });
        });

        it.each([["audio"], ["video"]])("reset %s", async (only) => {
            const stream = new MockMediaStream();
            const effectStream = new MockMediaStream();
            const store = createStore({
                initialState: {
                    localMedia: {
                        busyDeviceIds: [],
                        cameraEnabled: true,
                        devices: [],
                        isSettingCameraDevice: false,
                        isSettingMicrophoneDevice: false,
                        isSettingSpeakerDevice: false,
                        isTogglingCamera: false,
                        lowDataMode: false,
                        microphoneEnabled: true,
                        status: "started",
                        stream,
                        isSwitchingStream: false,
                    },
                },
            });

            await store.dispatch(
                localMediaSlice.doLocalStreamEffect({ effectStream: undefined, only: only as "audio" | "video" }),
            );

            const getTracks = only === "audio" ? "getAudioTracks" : "getVideoTracks";
            const getOtherTracks = only === "audio" ? "getVideoTracks" : "getAudioTracks";
            const effectedStreamSelectedTracks = effectStream[getTracks]();
            const originalStreamReplacedTracks = stream[getTracks]();
            const effectedStreamNotSelectedTracks = effectStream[getOtherTracks]();
            const originalStreamIntactTracks = stream[getOtherTracks]();

            originalStreamReplacedTracks.forEach((effectedTrack) => {
                const replaced = effectedStreamSelectedTracks.filter(
                    (selectedTrack) => selectedTrack.id === effectedTrack.id,
                );
                expect(replaced.length).toEqual(0);
            });

            originalStreamIntactTracks.forEach((intactTrack) => {
                const replaced = effectedStreamNotSelectedTracks.filter(
                    (notSelectedTrack) => notSelectedTrack.id === intactTrack.id,
                );
                expect(replaced.length).toEqual(0);
            });
        });
    });
});
