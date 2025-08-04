import {
    doStartLocalMedia,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
    toggleLowDataModeEnabled,
    setCurrentCameraDeviceId,
    setCurrentMicrophoneDeviceId,
    setCurrentSpeakerDeviceId,
    doStopLocalMedia,
} from "../../redux";
import type { Store as AppStore } from "../../redux/store";
import { selectLocalMediaState } from "./selector";
import {
    CAMERA_DEVICE_ERROR_CHANGED,
    CAMERA_DEVICES_CHANGED,
    CURRENT_CAMERA_CHANGED,
    CURRENT_MICROPHONE_CHANGED,
    CURRENT_SPEAKER_CHANGED,
    IS_SETTING_CAMERA_DEVICE,
    IS_SETTING_MICROPHONE_DEVICE,
    LOCAL_MEDIA_START_ERROR_CHANGED,
    LOCAL_MEDIA_STARTING,
    LOCAL_STREAM_CHANGED,
    MICROPHONE_DEVICE_ERROR_CHANGED,
    MICROPHONE_DEVICES_CHANGED,
    SPEAKER_DEVICES_CHANGED,
    type LocalMediaEvents,
} from "./events";
import type { LocalMediaState } from "./types";
import type { LocalMediaOptions } from "../../redux";
import { BaseClient } from "../BaseClient";

export class LocalMediaClient extends BaseClient<LocalMediaState, LocalMediaEvents> {
    private cameraDeviceErrorSubscribers = new Set<(error: unknown | null) => void>();
    private cameraDeviceSubscribers = new Set<(cameraDevices: MediaDeviceInfo[]) => void>();
    private isSettingCameraDeviceSubscribers = new Set<(isSetting: boolean) => void>();
    private isSettingMicrophoneDeviceSubscribers = new Set<(isSetting: boolean) => void>();
    private microphoneDeviceErrorSubscribers = new Set<(error: unknown | null) => void>();
    private microphoneDeviceSubscribers = new Set<(microphoneDevices: MediaDeviceInfo[]) => void>();
    private speakerDeviceSubscribers = new Set<(speakerDevices: MediaDeviceInfo[]) => void>();
    private currentCameraSubscribers = new Set<(cameraId?: string) => void>();
    private currentMicrophoneSubscribers = new Set<(microphoneId?: string) => void>();
    private currentSpeakerSubscribers = new Set<(speakerId?: string) => void>();
    private localMediaStartingSubscribers = new Set<(starting: boolean) => void>();
    private localStreamSubscribers = new Set<(stream?: MediaStream) => void>();
    private localMediaStartErrorSubscribers = new Set<(error: unknown | null) => void>();

    constructor(store: AppStore) {
        super(store);
    }

    protected handleStateChanges(state: LocalMediaState, previousState: LocalMediaState): void {
        if (state.cameraDeviceError !== previousState.cameraDeviceError) {
            this.cameraDeviceErrorSubscribers.forEach((cb) => cb(state.cameraDeviceError));
            this.emit(CAMERA_DEVICE_ERROR_CHANGED, state.cameraDeviceError);
        }

        if (state.cameraDevices !== previousState.cameraDevices) {
            this.cameraDeviceSubscribers.forEach((cb) => cb(state.cameraDevices));
            this.emit(CAMERA_DEVICES_CHANGED, state.cameraDevices);
        }

        if (state.isSettingCameraDevice !== previousState.isSettingCameraDevice) {
            this.isSettingCameraDeviceSubscribers.forEach((cb) => cb(state.isSettingCameraDevice));
            this.emit(IS_SETTING_CAMERA_DEVICE, state.isSettingCameraDevice);
        }

        if (state.isSettingMicrophoneDevice !== previousState.isSettingMicrophoneDevice) {
            this.isSettingMicrophoneDeviceSubscribers.forEach((cb) => cb(state.isSettingMicrophoneDevice));
            this.emit(IS_SETTING_MICROPHONE_DEVICE, state.isSettingMicrophoneDevice);
        }

        if (state.microphoneDeviceError !== previousState.microphoneDeviceError) {
            this.microphoneDeviceErrorSubscribers.forEach((cb) => cb(state.microphoneDeviceError));
            this.emit(MICROPHONE_DEVICE_ERROR_CHANGED, state.microphoneDeviceError);
        }

        if (state.microphoneDevices !== previousState.microphoneDevices) {
            this.microphoneDeviceSubscribers.forEach((cb) => cb(state.microphoneDevices));
            this.emit(MICROPHONE_DEVICES_CHANGED, state.microphoneDevices);
        }

        if (state.speakerDevices !== previousState.speakerDevices) {
            this.speakerDeviceSubscribers.forEach((cb) => cb(state.speakerDevices));
            this.emit(SPEAKER_DEVICES_CHANGED, state.speakerDevices);
        }

        if (state.currentCameraDeviceId !== previousState.currentCameraDeviceId) {
            this.currentCameraSubscribers.forEach((cb) => cb(state.currentCameraDeviceId));
            this.emit(CURRENT_CAMERA_CHANGED, state.currentCameraDeviceId);
        }

        if (state.currentMicrophoneDeviceId !== previousState.currentMicrophoneDeviceId) {
            this.currentMicrophoneSubscribers.forEach((cb) => cb(state.currentMicrophoneDeviceId));
            this.emit(CURRENT_MICROPHONE_CHANGED, state.currentMicrophoneDeviceId);
        }

        if (state.currentSpeakerDeviceId !== previousState.currentSpeakerDeviceId) {
            this.currentSpeakerSubscribers.forEach((cb) => cb(state.currentSpeakerDeviceId));
            this.emit(CURRENT_SPEAKER_CHANGED, state.currentSpeakerDeviceId);
        }

        if (state.isStarting !== previousState.isStarting) {
            this.localMediaStartingSubscribers.forEach((cb) => cb(state.isStarting));
            this.emit(LOCAL_MEDIA_STARTING, state.isStarting);
        }

        if (state.localStream !== previousState.localStream) {
            this.localStreamSubscribers.forEach((cb) => cb(state.localStream));
            this.emit(LOCAL_STREAM_CHANGED, state.localStream);
        }

        if (state.startError !== previousState.startError) {
            this.localMediaStartErrorSubscribers.forEach((cb) => cb(state.startError));
            this.emit(LOCAL_MEDIA_START_ERROR_CHANGED, state.startError);
        }
    }

    public getState(): LocalMediaState {
        return selectLocalMediaState(this.store.getState());
    }

    /* Subscriptions */

    public subscribeCameraDeviceError(callback: (error: unknown | null) => void): () => void {
        this.cameraDeviceErrorSubscribers.add(callback);

        return () => this.cameraDeviceErrorSubscribers.delete(callback);
    }

    public subscribeCameraDevices(callback: (cameraDevices: MediaDeviceInfo[]) => void): () => void {
        this.cameraDeviceSubscribers.add(callback);

        return () => this.cameraDeviceSubscribers.delete(callback);
    }

    public subscribeIsSettingCameraDevice(callback: (isSetting: boolean) => void): () => void {
        this.isSettingCameraDeviceSubscribers.add(callback);

        return () => this.isSettingCameraDeviceSubscribers.delete(callback);
    }

    public subscribeIsSettingMicrophoneDevice(callback: (isSetting: boolean) => void): () => void {
        this.isSettingMicrophoneDeviceSubscribers.add(callback);

        return () => this.isSettingMicrophoneDeviceSubscribers.delete(callback);
    }

    public subscribeMicrophoneDeviceError(callback: (error: unknown | null) => void): () => void {
        this.microphoneDeviceErrorSubscribers.add(callback);

        return () => this.microphoneDeviceErrorSubscribers.delete(callback);
    }

    public subscribeMicrophoneDevices(callback: (microphoneDevices: MediaDeviceInfo[]) => void): () => void {
        this.microphoneDeviceSubscribers.add(callback);

        return () => this.microphoneDeviceSubscribers.delete(callback);
    }

    public subscribeSpeakerDevices(callback: (speakerDevices: MediaDeviceInfo[]) => void): () => void {
        this.speakerDeviceSubscribers.add(callback);

        return () => this.speakerDeviceSubscribers.delete(callback);
    }

    public subscribeCurrentCamera(callback: (cameraId?: string) => void): () => void {
        this.currentCameraSubscribers.add(callback);

        return () => this.currentCameraSubscribers.delete(callback);
    }

    public subscribeCurrentMicrophone(callback: (microphoneId?: string) => void): () => void {
        this.currentMicrophoneSubscribers.add(callback);

        return () => this.currentMicrophoneSubscribers.delete(callback);
    }

    public subscribeCurrentSpeaker(callback: (speakerId?: string) => void): () => void {
        this.currentSpeakerSubscribers.add(callback);

        return () => this.currentSpeakerSubscribers.delete(callback);
    }

    public subscribeLocalMediaStarting(callback: (starting: boolean) => void): () => void {
        this.localMediaStartingSubscribers.add(callback);

        return () => this.localMediaStartingSubscribers.delete(callback);
    }

    public subscribeLocalStream(callback: (stream?: MediaStream) => void): () => void {
        this.localStreamSubscribers.add(callback);

        return () => this.localStreamSubscribers.delete(callback);
    }

    public subscribeLocalMediaStartError(callback: (error: unknown | null) => void): () => void {
        this.localMediaStartErrorSubscribers.add(callback);

        return () => this.localMediaStartErrorSubscribers.delete(callback);
    }

    /* Actions */

    public async startMedia(options: LocalMediaOptions | MediaStream = { audio: true, video: true }) {
        return this.store.dispatch(doStartLocalMedia(options));
    }

    public toggleCamera(enabled?: boolean) {
        this.store.dispatch(toggleCameraEnabled({ enabled }));
    }

    public toggleMicrophone(enabled?: boolean) {
        this.store.dispatch(toggleMicrophoneEnabled({ enabled }));
    }

    public toggleLowDataMode(enabled?: boolean) {
        this.store.dispatch(toggleLowDataModeEnabled({ enabled }));
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
     * Destroy the LocalMediaClient instance.
     * This method cleans up any resources and event listeners.
     */
    public destroy() {
        super.destroy();
        this.stopMedia();
        this.removeAllListeners();
        this.cameraDeviceSubscribers.clear();
        this.microphoneDeviceSubscribers.clear();
        this.speakerDeviceSubscribers.clear();
        this.currentCameraSubscribers.clear();
        this.currentMicrophoneSubscribers.clear();
        this.currentSpeakerSubscribers.clear();
        this.cameraDeviceErrorSubscribers.clear();
        this.microphoneDeviceErrorSubscribers.clear();
        this.isSettingCameraDeviceSubscribers.clear();
        this.isSettingMicrophoneDeviceSubscribers.clear();
        this.localMediaStartingSubscribers.clear();
        this.localStreamSubscribers.clear();
        this.localMediaStartErrorSubscribers.clear();
    }
}
