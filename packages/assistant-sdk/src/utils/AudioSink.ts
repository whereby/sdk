import wrtc from "@roamhq/wrtc";
const {
    nonstandard: { RTCAudioSink },
} = wrtc;

export class AudioSource {}

export class AudioSink {
    private _sink: wrtc.nonstandard.RTCAudioSink;

    constructor(track: MediaStreamTrack) {
        this._sink = new RTCAudioSink(track);
    }

    subscribe(cb: ({ samples }: { samples: Uint8Array; sampleRate: number }) => void) {
        this._sink.ondata = cb;
        return () => {
            this._sink.ondata = undefined;
        };
    }
}

