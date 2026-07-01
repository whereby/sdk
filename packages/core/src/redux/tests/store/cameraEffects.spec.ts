import * as cameraEffectsSlice from "../../slices/cameraEffects";
import * as localMediaSlice from "../../slices/localMedia";
import * as MediaDevices from "@whereby.com/media";
import { doAppStart, doAppStop } from "../../slices/app";
import { createStore } from "../store.setup";
import { RootState } from "../../store";

import MockMediaStream from "../../../__mocks__/MediaStream";
import MockMediaStreamTrack from "../../../__mocks__/MediaStreamTrack";

Object.defineProperty(window, "MediaStream", {
    writable: true,
    value: MockMediaStream,
});

Object.defineProperty(window, "MediaStreamTrack", {
    writable: true,
    value: MockMediaStreamTrack,
});

jest.mock("@whereby.com/media", () => ({
    __esModule: true,
    getStream: jest.fn(() => Promise.resolve()),
    getUpdatedDevices: jest.fn(() => Promise.resolve({ addedDevices: {}, changedDevices: {} })),
    getDeviceData: jest.fn(() => ({})),
    replaceTracksInStream: jest.fn((stream: MediaStream, newStream: MediaStream, only: "audio" | "video") => {
        const kind = only === "audio" ? "audio" : "video";
        const replaced = stream.getTracks().filter((t) => t.kind === kind);
        newStream.getTracks().forEach((t) => stream.addTrack(t));
        replaced.forEach((t) => stream.removeTrack(t));
        return replaced;
    }),
    RtcStatsConnection: jest.fn().mockImplementation(() => {
        return {};
    }),
}));

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
                        currentCameraDeviceId: "camera-1",
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
            jest.mocked(MediaDevices.getStream).mockImplementationOnce(async (_opts, options) => {
                const newRawTrack = new MockMediaStreamTrack("video");
                options?.replaceStream?.addTrack(newRawTrack);
                return { stream: options?.replaceStream as MediaStream, attempts: [] };
            });

            // Turn the camera back on -> effect should be re-applied to the new track.
            store.dispatch(localMediaSlice.toggleCameraEnabled({ enabled: true }));
            await flushMicrotasks();

            const createEffectStream = jest.mocked(jest.requireMock("@whereby.com/camera-effects").createEffectStream);
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
});
