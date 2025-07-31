import {
    doStartLocalMedia,
    toggleCameraEnabled,
    toggleMicrophoneEnabled,
    toggleLowDataModeEnabled,
    setCurrentCameraDeviceId,
    setCurrentMicrophoneDeviceId,
    setCurrentSpeakerDeviceId,
} from "../../redux";
import type { Store as AppStore } from "../../redux/store";
import { selectLocalMediaState } from "./selector";
import {
    CAMERA_DEVICES_CHANGED,
    CURRENT_CAMERA_CHANGED,
    CURRENT_MICROPHONE_CHANGED,
    CURRENT_SPEAKER_CHANGED,
    MICROPHONE_DEVICES_CHANGED,
    SPEAKER_DEVICES_CHANGED,
    type LocalMediaEvents,
} from "./events";
import type { LocalMediaState } from "./types";
import type { LocalMediaOptions } from "../../redux";
import { BaseClient } from "../BaseClient";

export class LocalMediaClient extends BaseClient<LocalMediaState, LocalMediaEvents> {
    private cameraDeviceSubscribers = new Set<(cameraDevices: MediaDeviceInfo[]) => void>();
    private microphoneDeviceSubscribers = new Set<(microphoneDevices: MediaDeviceInfo[]) => void>();
    private speakerDeviceSubscribers = new Set<(speakerDevices: MediaDeviceInfo[]) => void>();
    private currentCameraSubscribers = new Set<(cameraId: string | null) => void>();
    private currentMicrophoneSubscribers = new Set<(microphoneId: string | null) => void>();
    private currentSpeakerSubscribers = new Set<(speakerId: string | null) => void>();

    constructor(store: AppStore) {
        super(store);
    }

    protected handleStateChanges(state: LocalMediaState, previousState: LocalMediaState): void {
        if (state.cameraDevices !== previousState.cameraDevices) {
            this.cameraDeviceSubscribers.forEach((cb) => cb(state.cameraDevices));
            this.emit(CAMERA_DEVICES_CHANGED, state.cameraDevices);
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
            this.currentCameraSubscribers.forEach((cb) => cb(state.currentCameraDeviceId ?? null));
            this.emit(CURRENT_CAMERA_CHANGED, state.currentCameraDeviceId ?? null);
        }

        if (state.currentMicrophoneDeviceId !== previousState.currentMicrophoneDeviceId) {
            this.currentMicrophoneSubscribers.forEach((cb) => cb(state.currentMicrophoneDeviceId ?? null));
            this.emit(CURRENT_MICROPHONE_CHANGED, state.currentMicrophoneDeviceId ?? null);
        }

        if (state.currentSpeakerDeviceId !== previousState.currentSpeakerDeviceId) {
            this.currentSpeakerSubscribers.forEach((cb) => cb(state.currentSpeakerDeviceId ?? null));
            this.emit(CURRENT_SPEAKER_CHANGED, state.currentSpeakerDeviceId ?? null);
        }
    }

    public subscribeCameraDevices(callback: (cameraDevices: MediaDeviceInfo[]) => void): () => void {
        this.cameraDeviceSubscribers.add(callback);

        return () => this.cameraDeviceSubscribers.delete(callback);
    }

    public subscribeMicrophoneDevices(callback: (microphoneDevices: MediaDeviceInfo[]) => void): () => void {
        this.microphoneDeviceSubscribers.add(callback);

        return () => this.microphoneDeviceSubscribers.delete(callback);
    }

    public subscribeSpeakerDevices(callback: (speakerDevices: MediaDeviceInfo[]) => void): () => void {
        this.speakerDeviceSubscribers.add(callback);

        return () => this.speakerDeviceSubscribers.delete(callback);
    }

    public subscribeCurrentCamera(callback: (cameraId: string | null) => void): () => void {
        this.currentCameraSubscribers.add(callback);

        return () => this.currentCameraSubscribers.delete(callback);
    }

    public subscribeCurrentMicrophone(callback: (microphoneId: string | null) => void): () => void {
        this.currentMicrophoneSubscribers.add(callback);

        return () => this.currentMicrophoneSubscribers.delete(callback);
    }

    public subscribeCurrentSpeaker(callback: (speakerId: string | null) => void): () => void {
        this.currentSpeakerSubscribers.add(callback);

        return () => this.currentSpeakerSubscribers.delete(callback);
    }

    public getState(): LocalMediaState {
        return selectLocalMediaState(this.store.getState());
    }

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

    /**
     * Destroy the LocalMediaClient instance.
     * This method cleans up any resources and event listeners.
     */
    public destroy() {
        this.removeAllListeners();
    }
}
