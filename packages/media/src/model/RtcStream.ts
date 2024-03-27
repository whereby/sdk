import { TYPES as CONNECTION_STATUS_TYPES } from "./connectionStatusConstants";
const CAMERA_STREAM_ID = "0";

export const STREAM_TYPES = {
    CAMERA: "camera",
    SCREEN_SHARE: "screen_share",
};

export class RtcStream {
    id: string;
    type: string;
    isEnabled: boolean;
    hasSupportForAutoSuperSize: boolean;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    status: string;
    stream: MediaStream | null;
    streamId: string | null;

    constructor(id: string | number, type: string) {
        this.id = "" + id;
        this.type = type;

        this.isEnabled = true;
        this.hasSupportForAutoSuperSize = false;
        this.isAudioEnabled = true;
        this.isVideoEnabled = true;
        this.status = CONNECTION_STATUS_TYPES.CONNECTING;
        this.stream = null;
        this.streamId = null;
    }

    setup(stream: MediaStream) {
        this.stream = stream;
        this.streamId = stream.id;
        this.setVideoEnabled(this.isVideoEnabled && stream.getVideoTracks().length > 0);
        this.setAudioEnabled(this.isAudioEnabled && stream.getAudioTracks().length > 0);
        return this;
    }

    setStatus(status: string) {
        this.status = status;
        return this;
    }

    setVideoEnabled(isEnabled: boolean) {
        this.isVideoEnabled = isEnabled;
        if (!this.stream) {
            return;
        }
        this.stream.getVideoTracks().forEach((track) => {
            track.enabled = isEnabled;
        });
    }

    setAudioEnabled(isEnabled: boolean) {
        this.isAudioEnabled = isEnabled;
        if (!this.stream) {
            return;
        }
        this.stream.getAudioTracks().forEach((track) => {
            track.enabled = isEnabled;
        });
    }

    static getCameraId() {
        return CAMERA_STREAM_ID;
    }

    static getTypeFromId(id: string) {
        const streamId = "" + id;
        return streamId === CAMERA_STREAM_ID ? STREAM_TYPES.CAMERA : STREAM_TYPES.SCREEN_SHARE;
    }
}
