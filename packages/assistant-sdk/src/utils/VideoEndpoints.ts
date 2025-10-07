import wrtc from "@roamhq/wrtc";

const {
    nonstandard: { RTCVideoSink, RTCVideoSource },
} = wrtc;

export class VideoSource extends RTCVideoSource {}

export class VideoSink extends RTCVideoSink {
    private _sink: wrtc.nonstandard.RTCVideoSink;

    constructor(track: MediaStreamTrack) {
        super(track);
        this._sink = new RTCVideoSink(track);
    }

    subscribe(cb: (d: { width: number; height: number; data: Uint8ClampedArray; rotation: number }) => void) {
        this._sink.onframe = cb;
        return () => {
            this._sink.onframe = undefined;
        };
    }
}
