/* Local media events */
export const CAMERA_DEVICES_CHANGED = "local-media:camera-devices-changed";
export const MICROPHONE_DEVICES_CHANGED = "local-media:microphone-devices-changed";
export const SPEAKER_DEVICES_CHANGED = "local-media:speaker-devices-changed";
export const CURRENT_CAMERA_CHANGED = "local-media:current-camera-changed";
export const CURRENT_MICROPHONE_CHANGED = "local-media:current-microphone-changed";
export const CURRENT_SPEAKER_CHANGED = "local-media:current-speaker-changed";

export type LocalMediaEvents = {
    [CAMERA_DEVICES_CHANGED]: [devices: MediaDeviceInfo[]];
    [MICROPHONE_DEVICES_CHANGED]: [devices: MediaDeviceInfo[]];
    [SPEAKER_DEVICES_CHANGED]: [devices: MediaDeviceInfo[]];
    [CURRENT_CAMERA_CHANGED]: [deviceId: string | null];
    [CURRENT_MICROPHONE_CHANGED]: [deviceId: string | null];
    [CURRENT_SPEAKER_CHANGED]: [speakerId: string | null];
};
