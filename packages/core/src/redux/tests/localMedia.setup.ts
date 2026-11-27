import { createStore } from "./store.setup";
import MockMediaStreamTrack from "../../__mocks__/MediaStreamTrack";

export const audioDevice = {
    deviceId: "audioDeviceId",
    kind: "audioinput" as const,
    label: "Microphone",
    groupId: "a",
    toJSON: () => ({}),
};
export const videoDevice = {
    deviceId: "videoDeviceId",
    kind: "videoinput" as const,
    label: "Camera",
    groupId: "b",
    toJSON: () => ({}),
};

export const createLiveTrack = (kind: "audio" | "video", deviceId: string) => {
    const track: MediaStreamTrack & { readyState: MediaStreamTrackState } = new MockMediaStreamTrack(kind);
    track.readyState = "live";
    track.getSettings = () => ({ deviceId });
    return track;
};

export const waitForSwitch = (store: ReturnType<typeof createStore>) =>
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

export const waitForSetDevice = (store: ReturnType<typeof createStore>) =>
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
