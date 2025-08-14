import { PassThrough } from "stream";

import wrtc from "@roamhq/wrtc";
const {
    nonstandard: { RTCAudioSink },
} = wrtc;
export class AudioSource extends PassThrough {
    constructor() {
        super({
            allowHalfOpen: true,
            highWaterMark: 1 * 1024,
        });
    }
}

export class AudioSink extends wrtc.nonstandard.RTCAudioSink {
    private _sink: wrtc.nonstandard.RTCAudioSink;

    constructor(track: MediaStreamTrack) {
        super(track);
        this._sink = new RTCAudioSink(track);
    }

    subscribe(cb: ({ samples }: { samples: Uint8Array; sampleRate: number }) => void) {
        this._sink.ondata = cb;
        return () => {
            this._sink.ondata = undefined;
        };
    }
}
