import wrtc from "@roamhq/wrtc";

const {
    nonstandard: { RTCAudioSink, RTCAudioSource },
} = wrtc;

export class AudioSource extends RTCAudioSource {}

export class AudioSink extends RTCAudioSink {
    subscribe(
        cb: (d: {
            samples: Int16Array;
            sampleRate: number;
            channelCount: number;
            bitsPerSample: number;
            numberOfFrames?: number;
        }) => void,
    ) {
        this.ondata = cb;
        return () => {
            this.ondata = undefined;
        };
    }
}
