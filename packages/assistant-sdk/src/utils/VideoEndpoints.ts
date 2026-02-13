import wrtc from "@roamhq/wrtc";

const {
    nonstandard: { RTCVideoSink, RTCVideoSource },
} = wrtc;

export class VideoSource extends RTCVideoSource {}
type VideoTrackEvent = {
    type: "frame";
    frame: {
        width: number;
        height: number;
        rotation: number;
        data: Uint8Array;
    };
};

export class VideoSink extends RTCVideoSink {
    private _sink: wrtc.nonstandard.RTCVideoSink;

    constructor(track: MediaStreamTrack) {
        super(track);
        this._sink = new RTCVideoSink(track);
    }

    subscribe(cb: (d: VideoTrackEvent) => void) {
        this._sink.onframe = cb;
        return () => {
            this._sink.onframe = undefined;
        };
    }
}
