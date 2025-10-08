import wrtc from "@roamhq/wrtc";

const {
    nonstandard: { RTCAudioSink, RTCAudioSource },
} = wrtc;

export class AudioSource extends RTCAudioSource {}

export class AudioSink extends RTCAudioSink {
    private _sink: wrtc.nonstandard.RTCAudioSink;

    constructor(track: MediaStreamTrack) {
        super(track);
        this._sink = new RTCAudioSink(track);
    }

    subscribe(
        cb: (d: {
            samples: Int16Array;
            sampleRate: number;
            channelCount: number;
            bitsPerSample: number;
            numberOfFrames?: number;
        }) => void,
    ) {
        this._sink.ondata = cb;
        return () => {
            this._sink.ondata = undefined;
        };
    }
}
