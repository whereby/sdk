import { TYPES as CONNECTION_STATUS_TYPES } from "./connectionStatusConstants";
import assert from "../utils/assert";
const CAMERA_STREAM_ID = "0";

export const STREAM_TYPES = {
    CAMERA: "camera",
    SCREEN_SHARE: "screen_share",
};

export default class RtcStream {
    constructor(id, type) {
        assert.notEqual(id, undefined, "id is required");
        assert.notEqual(type, undefined, "type is required");

        this.id = "" + id;
        this.type = type;

        this.isEnabled = true;
        this.hasSupportForAutoSuperSize = false;
        this.isAudioEnabled = true;
        this.isVideoEnabled = true;
        this.status = CONNECTION_STATUS_TYPES.CONNECTING;
    }

    setup(stream) {
        this.stream = stream;
        this.streamId = stream.id;
        this.setVideoEnabled(this.isVideoEnabled && stream.getVideoTracks().length > 0);
        this.setAudioEnabled(this.isAudioEnabled && stream.getAudioTracks().length > 0);
        return this;
    }

    setStatus(status) {
        this.status = status;
        return this;
    }

    setVideoEnabled(isEnabled) {
        this.isVideoEnabled = isEnabled;
        if (!this.stream) {
            return;
        }
        this.stream.getVideoTracks().forEach((track) => {
            track.enabled = isEnabled;
        });
    }

    setAudioEnabled(isEnabled) {
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

    static getTypeFromId(id) {
        assert.notEqual(id, undefined, "id is required");

        const streamId = "" + id;
        return streamId === CAMERA_STREAM_ID ? STREAM_TYPES.CAMERA : STREAM_TYPES.SCREEN_SHARE;
    }
}
