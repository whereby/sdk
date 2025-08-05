/* Local media events */
export const CAMERA_DEVICE_ERROR_CHANGED = "local-media:camera-device-error-changed";
export const CAMERA_DEVICES_CHANGED = "local-media:camera-devices-changed";
export const IS_SETTING_CAMERA_DEVICE = "local-media:is-setting-camera-device";
export const IS_SETTING_MICROPHONE_DEVICE = "local-media:is-setting-microphone-device";
export const MICROPHONE_DEVICE_ERROR_CHANGED = "local-media:microphone-device-error-changed";
export const MICROPHONE_DEVICES_CHANGED = "local-media:microphone-devices-changed";
export const SPEAKER_DEVICES_CHANGED = "local-media:speaker-devices-changed";
export const CURRENT_CAMERA_CHANGED = "local-media:current-camera-changed";
export const CURRENT_MICROPHONE_CHANGED = "local-media:current-microphone-changed";
export const CURRENT_SPEAKER_CHANGED = "local-media:current-speaker-changed";
export const LOCAL_MEDIA_STARTING = "local-media:starting";
export const LOCAL_STREAM_CHANGED = "local-media:local-stream-changed";
export const LOCAL_MEDIA_START_ERROR_CHANGED = "local-media:start-error-changed";

export type LocalMediaEvents = {
    [CAMERA_DEVICE_ERROR_CHANGED]: [error: unknown | null];
    [CAMERA_DEVICES_CHANGED]: [devices: MediaDeviceInfo[]];
    [IS_SETTING_CAMERA_DEVICE]: [isSetting: boolean];
    [IS_SETTING_MICROPHONE_DEVICE]: [isSetting: boolean];
    [MICROPHONE_DEVICE_ERROR_CHANGED]: [error: unknown | null];
    [MICROPHONE_DEVICES_CHANGED]: [devices: MediaDeviceInfo[]];
    [SPEAKER_DEVICES_CHANGED]: [devices: MediaDeviceInfo[]];
    [CURRENT_CAMERA_CHANGED]: [deviceId?: string];
    [CURRENT_MICROPHONE_CHANGED]: [deviceId?: string];
    [CURRENT_SPEAKER_CHANGED]: [speakerId?: string];
    [LOCAL_MEDIA_STARTING]: [starting: boolean];
    [LOCAL_STREAM_CHANGED]: [stream?: MediaStream];
    [LOCAL_MEDIA_START_ERROR_CHANGED]: [error: unknown | null];
};
