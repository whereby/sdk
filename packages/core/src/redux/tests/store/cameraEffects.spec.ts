import * as cameraEffectsSlice from "../../slices/cameraEffects";
import * as localMediaSlice from "../../slices/localMedia";
import { createEffectStream } from "@whereby.com/camera-effects";
import { doAppStart, doAppStop } from "../../slices/app";
import { createStore } from "../store.setup";
import { audioDevice, createLiveTrack, videoDevice, waitForSetDevice, waitForSwitch } from "../localMedia.setup";
import { RootState } from "../../store";

import MockMediaStream from "../../../__mocks__/MediaStream";
import MockMediaStreamTrack from "../../../__mocks__/MediaStreamTrack";
import mockMediaDevices from "../../../__mocks__/mediaDevices";

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

const mockedGetUserMedia = jest.mocked(navigator.mediaDevices.getUserMedia);

const mockEffectStop = jest.fn();
jest.mock("@whereby.com/camera-effects", () => ({
    __esModule: true,
    createEffectStream: jest.fn(async () => ({
        stream: new MockMediaStream([new MockMediaStreamTrack("video")]),
        stop: mockEffectStop,
        tryUpdate: jest.fn(async () => true),
    })),
    getUsablePresets: jest.fn(() => ["image-blur"]),
}));

// Flush queued microtasks so async listener chains (toggle -> pause/resume) settle.
const flushMicrotasks = async () => {
    for (let i = 0; i < 30; i++) {
        await Promise.resolve();
    }
};

const startedLocalMedia = (overrides: Partial<RootState["localMedia"]>): RootState["localMedia"] => ({
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
    widescreenMode: true,
    ...overrides,
});

describe("cameraEffectsSlice", () => {
    describe("reactors", () => {
        it("does not clear the effect when it is applied before the app becomes active (pre-call)", () => {
            const store = createStore();
            const stop = jest.fn();

            store.dispatch(
                cameraEffectsSlice.cameraEffectsUpdated({
                    effectId: "image-blur",
                    raw: { stop },
                }),
            );

            const state = store.getState().cameraEffects;
            expect(state.currentEffectId).toBe("image-blur");
            expect(state.raw.stop).toBe(stop);
            expect(stop).not.toHaveBeenCalled();
        });

        it("clears the effect when the app stops", () => {
            const store = createStore();
            const stop = jest.fn();

            store.dispatch(
                doAppStart({
                    displayName: "Test",
                    externalId: null,
                    roomKey: null,
                    roomUrl: "https://example.whereby.com/test",
                }),
            );
            store.dispatch(
                cameraEffectsSlice.cameraEffectsUpdated({
                    effectId: "image-blur",
                    raw: { stop },
                }),
            );

            expect(store.getState().cameraEffects.currentEffectId).toBe("image-blur");

            store.dispatch(doAppStop());

            const state = store.getState().cameraEffects;
            expect(state.currentEffectId).toBeNull();
            expect(state.raw).toEqual({});
        });
    });

    describe("cameraEffectsPaused reducer", () => {
        it("remembers the effect config and drops the live pipeline", () => {
            const store = createStore();
            const stop = jest.fn();

            store.dispatch(cameraEffectsSlice.cameraEffectsUpdated({ effectId: "image-blur", raw: { stop } }));
            store.dispatch(cameraEffectsSlice.cameraEffectsPaused());

            const state = store.getState().cameraEffects;
            expect(state.isPaused).toBe(true);
            expect(state.currentEffectId).toBe("image-blur");
            expect(state.raw).toEqual({});
        });

        it("can set the effect config from the payload (effect picked while camera off)", () => {
            const store = createStore();

            store.dispatch(
                cameraEffectsSlice.cameraEffectsPaused({ effectId: "image-custom", backgroundUrl: "data:image/x" }),
            );

            const state = store.getState().cameraEffects;
            expect(state.isPaused).toBe(true);
            expect(state.currentEffectId).toBe("image-custom");
            expect(state.backgroundUrl).toBe("data:image/x");
        });

        it("is reset when the effect is cleared", () => {
            const store = createStore();

            store.dispatch(cameraEffectsSlice.cameraEffectsPaused({ effectId: "image-blur" }));
            store.dispatch(cameraEffectsSlice.cameraEffectsCleared());

            const state = store.getState().cameraEffects;
            expect(state.isPaused).toBe(false);
            expect(state.currentEffectId).toBeNull();
        });
    });

    describe("doCameraEffectsSwitchPreset with the camera off", () => {
        it("remembers the requested effect as paused instead of clearing it", async () => {
            const audioTrack = new MockMediaStreamTrack("audio");
            const store = createStore({
                initialState: {
                    localMedia: startedLocalMedia({
                        cameraEnabled: false,
                        stream: new MockMediaStream([audioTrack]),
                    }),
                },
            });

            await store.dispatch(cameraEffectsSlice.doCameraEffectsSwitchPreset({ effectId: "image-blur" }));

            const state = store.getState().cameraEffects;
            expect(state.isPaused).toBe(true);
            expect(state.currentEffectId).toBe("image-blur");
        });
    });

    describe("doCameraEffectsPause", () => {
        it("stops the pipeline and the source track, and marks the effect paused", async () => {
            const stop = jest.fn();
            const sourceTrack = new MockMediaStreamTrack("video");
            const audioTrack = new MockMediaStreamTrack("audio");

            const store = createStore({
                initialState: {
                    localMedia: startedLocalMedia({
                        cameraEnabled: false,
                        stream: new MockMediaStream([audioTrack]),
                        beforeEffectTracks: { video: sourceTrack },
                    }),
                    cameraEffects: {
                        currentEffectId: "image-blur",
                        isPaused: false,
                        isSwitching: false,
                        raw: { stop, effectStream: new MockMediaStream() },
                    },
                },
            });

            await store.dispatch(cameraEffectsSlice.doCameraEffectsPause());

            const state = store.getState().cameraEffects;
            expect(stop).toHaveBeenCalledTimes(1);
            expect(sourceTrack.stop).toHaveBeenCalledTimes(1);
            expect(state.isPaused).toBe(true);
            expect(state.currentEffectId).toBe("image-blur");
            expect(state.raw).toEqual({});
        });
    });

    describe("camera toggle coordination (via the real toggleCameraEnabled trigger)", () => {
        it("pauses a running effect when toggleCameraEnabled(false) drives doToggleCamera", async () => {
            const stop = jest.fn();
            const effectTrack = new MockMediaStreamTrack("video");
            const sourceTrack = new MockMediaStreamTrack("video");
            const audioTrack = new MockMediaStreamTrack("audio");
            const stream = new MockMediaStream([audioTrack, effectTrack]);

            const store = createStore({
                initialState: {
                    localMedia: startedLocalMedia({
                        cameraEnabled: true,
                        stream,
                        beforeEffectTracks: { video: sourceTrack },
                    }),
                    cameraEffects: {
                        currentEffectId: "image-blur",
                        isPaused: false,
                        isSwitching: false,
                        raw: { stop, tryUpdate: jest.fn(), effectStream: new MockMediaStream() },
                    },
                },
            });

            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: false }));
            await flushMicrotasks();

            const state = store.getState().cameraEffects;
            expect(stop).toHaveBeenCalledTimes(1);
            expect(state.isPaused).toBe(true);
            expect(state.raw).toEqual({});
        });
    });

    describe("full off -> on cycle re-applies the effect", () => {
        it("re-applies the effect when the camera is turned back on", async () => {
            const stop = jest.fn();
            const effectTrack = new MockMediaStreamTrack("video");
            const sourceTrack = new MockMediaStreamTrack("video");
            const audioTrack = new MockMediaStreamTrack("audio");
            const stream = new MockMediaStream([audioTrack, effectTrack]);

            const store = createStore({
                initialState: {
                    localMedia: startedLocalMedia({
                        cameraEnabled: true,
                        currentCameraDeviceId: videoDevice.deviceId,
                        devices: [audioDevice, videoDevice],
                        stream,
                        beforeEffectTracks: { video: sourceTrack },
                    }),
                    cameraEffects: {
                        currentEffectId: "image-blur",
                        isPaused: false,
                        isSwitching: false,
                        raw: { stop, tryUpdate: jest.fn(), effectStream: new MockMediaStream() },
                    },
                },
            });

            // Turn the camera off -> effect should pause (remembered).
            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: false }));
            await flushMicrotasks();
            expect(store.getState().cameraEffects.isPaused).toBe(true);

            // When the camera is turned on, doToggleCamera acquires a fresh raw track.
            mockedGetUserMedia.mockResolvedValueOnce(
                new MockMediaStream([createLiveTrack("video", videoDevice.deviceId)]),
            );

            // Turn the camera back on -> effect should be re-applied to the new track.
            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: true }));
            await flushMicrotasks();

            const createEffectStream = jest.mocked(
                jest.requireMock("@whereby.com/camera-effects").createEffectStream,
            );
            const state = store.getState().cameraEffects;
            expect(createEffectStream).toHaveBeenCalled();
            expect(state.isPaused).toBe(false);
            expect(state.currentEffectId).toBe("image-blur");
            expect(state.raw.stop).toBe(mockEffectStop);
        });
    });

    describe("camera toggle coordination", () => {
        it("pauses a running effect when the camera is turned off", async () => {
            const stop = jest.fn();
            const effectTrack = new MockMediaStreamTrack("video");
            const sourceTrack = new MockMediaStreamTrack("video");
            const audioTrack = new MockMediaStreamTrack("audio");
            const stream = new MockMediaStream([audioTrack, effectTrack]);

            const store = createStore({
                initialState: {
                    // Camera has just been toggled off; doToggleCamera will tear down the
                    // effect (video) track that is currently in the stream.
                    localMedia: startedLocalMedia({
                        cameraEnabled: false,
                        stream,
                        beforeEffectTracks: { video: sourceTrack },
                    }),
                    cameraEffects: {
                        currentEffectId: "image-blur",
                        isPaused: false,
                        isSwitching: false,
                        raw: { stop, effectStream: new MockMediaStream() },
                    },
                },
            });

            await store.dispatch(localMediaSlice.doToggleCamera());
            await flushMicrotasks();

            const state = store.getState().cameraEffects;
            expect(stop).toHaveBeenCalledTimes(1);
            expect(state.isPaused).toBe(true);
            expect(state.currentEffectId).toBe("image-blur");
            expect(state.raw).toEqual({});
        });
    });

    describe("camera switches", () => {
        const otherCamera = { ...videoDevice, deviceId: "otherVideoDeviceId", label: "Other camera" };

        const createStoreWithEffect = () => {
            const rawTrack = createLiveTrack("video", videoDevice.deviceId);
            const effectTrack = new MockMediaStreamTrack("video");
            const stopEffect = jest.fn();
            const stream = new MockMediaStream([createLiveTrack("audio", audioDevice.deviceId), effectTrack]);
            const store = createStore({
                initialState: {
                    localMedia: startedLocalMedia({
                        currentCameraDeviceId: videoDevice.deviceId,
                        devices: [audioDevice, videoDevice, otherCamera],
                        stream,
                        beforeEffectTracks: { video: rawTrack },
                    }),
                    cameraEffects: {
                        currentEffectId: "image-blur",
                        isPaused: false,
                        isSwitching: false,
                        raw: { stop: stopEffect, effectStream: new MockMediaStream([effectTrack]) },
                    },
                },
            });
            return { store, stream, rawTrack, stopEffect };
        };

        const mockNextEffectTrack = () => {
            const effectTrack = new MockMediaStreamTrack("video");
            jest.mocked(createEffectStream).mockResolvedValueOnce({
                stream: new MockMediaStream([effectTrack]),
                stop: jest.fn(),
                tryUpdate: jest.fn(async () => true),
            });
            return effectTrack;
        };

        const waitForEffect = (store: ReturnType<typeof createStore>) =>
            new Promise<void>((resolve) => {
                const isApplied = () => {
                    const { isPaused, isSwitching, raw } = store.getState().cameraEffects;
                    return !isPaused && !isSwitching && !!raw.stop;
                };
                if (isApplied()) {
                    return resolve();
                }
                const unsubscribe = store.subscribe(() => {
                    if (isApplied()) {
                        unsubscribe();
                        resolve();
                    }
                });
            });

        it("applies the effect again on the new track after a low data mode change", async () => {
            const { store, stream, rawTrack, stopEffect } = createStoreWithEffect();
            const switchedTrack = createLiveTrack("video", videoDevice.deviceId);
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([switchedTrack]));
            const newEffectTrack = mockNextEffectTrack();

            store.dispatch(localMediaSlice.toggleLowDataModeEnabled({ enabled: true }));
            await waitForSwitch(store);
            await waitForEffect(store);

            expect(mockedGetUserMedia).toHaveBeenCalledTimes(1);
            expect(stopEffect).toHaveBeenCalled();
            expect(rawTrack.stop).toHaveBeenCalled();
            expect(store.getState().localMedia.beforeEffectTracks?.video).toBe(switchedTrack);
            expect(stream.getVideoTracks()).toEqual([newEffectTrack]);
        });

        it("holds only the picked camera after a pick", async () => {
            const { store, stream, rawTrack } = createStoreWithEffect();
            const pickedTrack = createLiveTrack("video", otherCamera.deviceId);
            mockedGetUserMedia.mockResolvedValueOnce(new MockMediaStream([pickedTrack]));
            const newEffectTrack = mockNextEffectTrack();

            store.dispatch(localMediaSlice.setCurrentCameraDeviceId({ deviceId: otherCamera.deviceId }));
            await waitForSetDevice(store);
            await waitForEffect(store);

            expect(rawTrack.stop).toHaveBeenCalled();
            expect(store.getState().localMedia.beforeEffectTracks?.video).toBe(pickedTrack);
            expect(store.getState().localMedia.currentCameraDeviceId).toBe(otherCamera.deviceId);
            expect(stream.getVideoTracks()).toEqual([newEffectTrack]);
        });

        it("keeps the effect on the camera we hold after a failed pick", async () => {
            const { store, stream, rawTrack } = createStoreWithEffect();
            mockedGetUserMedia.mockRejectedValueOnce(new DOMException("Requested device not found", "NotFoundError"));

            store.dispatch(localMediaSlice.setCurrentCameraDeviceId({ deviceId: otherCamera.deviceId }));
            await waitForSetDevice(store);
            await waitForEffect(store);

            expect(rawTrack.stop).not.toHaveBeenCalled();
            expect(store.getState().localMedia.beforeEffectTracks?.video).toBe(rawTrack);
            expect(stream.getVideoTracks()).toHaveLength(1);
            expect(stream.getVideoTracks()).not.toContain(rawTrack);
        });
    });
});
