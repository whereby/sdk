import {
    doStartLocalMedia,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
    toggleHdModeEnabled,
    toggleLowDataModeEnabled,
    toggleWidescreenModeEnabled,
    setCurrentCameraDeviceId,
    setCurrentMicrophoneDeviceId,
    setCurrentSpeakerDeviceId,
    doStopLocalMedia,
} from "../../redux";
import type { Store as AppStore } from "../../redux/store";
import { type LocalMediaEvents } from "./events";
import { localMediaStateDefinition } from "./state";
import type { LocalMediaState } from "./types";
import type { LocalMediaOptions } from "../../redux";
import { BaseClient } from "../BaseClient";

export class LocalMediaClient extends BaseClient<LocalMediaState, LocalMediaEvents> {
    constructor(store: AppStore) {
        super(store, localMediaStateDefinition);
    }

    /* Subscriptions */

    public subscribeCameraDeviceError(callback: (error: unknown | null) => void): () => void {
        return this.subscribeToStateKey("cameraDeviceError", callback);
    }

    public subscribeCameraDevices(callback: (cameraDevices: MediaDeviceInfo[]) => void): () => void {
        return this.subscribeToStateKey("cameraDevices", callback);
    }

    public subscribeCameraEnabled(callback: (isCameraEnabled: boolean) => void): () => void {
        return this.subscribeToStateKey("isCameraEnabled", callback);
    }

    public subscribeMicrophoneEnabled(callback: (isMicrophoneEnabled: boolean) => void): () => void {
        return this.subscribeToStateKey("isMicrophoneEnabled", callback);
    }

    public subscribeIsSettingCameraDevice(callback: (isSetting: boolean) => void): () => void {
        return this.subscribeToStateKey("isSettingCameraDevice", callback);
    }

    public subscribeIsSettingMicrophoneDevice(callback: (isSetting: boolean) => void): () => void {
        return this.subscribeToStateKey("isSettingMicrophoneDevice", callback);
    }

    public subscribeMicrophoneDeviceError(callback: (error: unknown | null) => void): () => void {
        return this.subscribeToStateKey("microphoneDeviceError", callback);
    }

    public subscribeMicrophoneDevices(callback: (microphoneDevices: MediaDeviceInfo[]) => void): () => void {
        return this.subscribeToStateKey("microphoneDevices", callback);
    }

    public subscribeSpeakerDevices(callback: (speakerDevices: MediaDeviceInfo[]) => void): () => void {
        return this.subscribeToStateKey("speakerDevices", callback);
    }

    public subscribeCurrentCamera(callback: (cameraId?: string) => void): () => void {
        return this.subscribeToStateKey("currentCameraDeviceId", callback);
    }

    public subscribeCurrentMicrophone(callback: (microphoneId?: string) => void): () => void {
        return this.subscribeToStateKey("currentMicrophoneDeviceId", callback);
    }

    public subscribeCurrentSpeaker(callback: (speakerId?: string) => void): () => void {
        return this.subscribeToStateKey("currentSpeakerDeviceId", callback);
    }

    public subscribeLocalMediaStarting(callback: (starting: boolean) => void): () => void {
        return this.subscribeToStateKey("isStarting", callback);
    }

    public subscribeLocalStream(callback: (stream?: MediaStream) => void): () => void {
        return this.subscribeToStateKey("localStream", callback);
    }

    public subscribeLocalMediaStartError(callback: (error: unknown | null) => void): () => void {
        return this.subscribeToStateKey("startError", callback);
    }

    /* Actions */

    public async startMedia(options: LocalMediaOptions | MediaStream = { audio: true, video: true }) {
        return await this.store.dispatch(doStartLocalMedia(options));
    }

    public toggleCamera(enabled?: boolean) {
        this.store.dispatch(toggleCameraEnabled({ enabled }));
    }

    public toggleMicrophone(enabled?: boolean) {
        this.store.dispatch(toggleMicrophoneEnabled({ enabled }));
    }

    public toggleHdMode(enabled?: boolean) {
        this.store.dispatch(toggleHdModeEnabled({ enabled }));
    }

    public toggleLowDataMode(enabled?: boolean) {
        this.store.dispatch(toggleLowDataModeEnabled({ enabled }));
    }

    public toggleWidescreenMode(enabled?: boolean) {
        this.store.dispatch(toggleWidescreenModeEnabled({ enabled }));
    }

    public setCameraDevice(deviceId: string) {
        this.store.dispatch(setCurrentCameraDeviceId({ deviceId }));
    }

    public setMicrophoneDevice(deviceId: string) {
        this.store.dispatch(setCurrentMicrophoneDeviceId({ deviceId }));
    }

    public setSpeakerDevice(deviceId: string) {
        this.store.dispatch(setCurrentSpeakerDeviceId({ deviceId }));
    }

    public stopMedia() {
        return this.store.dispatch(doStopLocalMedia());
    }

    /**
     * Stops the local media when the client is destroyed.
     */
    protected onDestroy() {
        this.stopMedia();
    }
}
