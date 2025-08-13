import { PassThrough } from "stream";

import wrtc from "@roamhq/wrtc";

export class AudioSource extends PassThrough {
    constructor() {
        super({
            allowHalfOpen: true,
            highWaterMark: 1 * 1024,
        });
    }
}

export class AudioSink extends wrtc.nonstandard.RTCAudioSink {}
