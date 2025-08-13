import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import fs from "fs";
import Stream from "stream";
import wrtc from "@roamhq/wrtc";
import { AudioSink } from "./AudioSink";
import { RTCAudioData } from "@roamhq/wrtc/types/nonstandard";

export const STREAM_INPUT_SAMPLE_RATE_IN_HZ = 48000;

export function getFFmpegArguments(numberOfParticipants: number) {
    const ffArgs = [];
    for (let i = 0; i < numberOfParticipants; i++) {
        ffArgs.push(
            "-f",
            "s16le",
            "-ar",
            String(STREAM_INPUT_SAMPLE_RATE_IN_HZ),
            "-ac",
            String(1),
            "-i",
            `pipe:${3 + i}`,
        );
    }
    // Mix, add a little headroom with volume if you like
    ffArgs.push(
        "-filter_complex",
        `amix=inputs=${numberOfParticipants}:dropout_transition=250,volume=1.0`,
        // Output: WAV (change to s16le/raw if you prefer raw PCM on stdout)
        "-f",
        "s16le",
        "pipe:1",
    );
    return ffArgs;
}

export function spawnFFmpegProcess(numberOfParticipants: number, audioSource: NodeJS.WritableStream) {
    const stdio = ["ignore", "pipe", "inherit", ...Array(numberOfParticipants).fill("pipe")];
    const args = getFFmpegArguments(numberOfParticipants);
    const ffmpegProcess = spawn("ffmpeg", args, { stdio });

    const out = fs.createWriteStream("./output.pcm");
    ffmpegProcess.stdout.pipe(audioSource);
    ffmpegProcess.stdout.pipe(out);
    ffmpegProcess.on("error", (err) => {
        console.error("FFmpeg process error:", err);
    });
    out.on("error", (err) => {
        console.error("Output stream error:", err);
    });

    return ffmpegProcess;
}

export function writeAudioDataToFFmpeg(
    ffmpegProcess: ChildProcessWithoutNullStreams,
    inputIndex: number,
    audioTrack: wrtc.MediaStreamTrack,
) {
    // TODO: FIX THIS
    const writer = ffmpegProcess!.stdio[3 + inputIndex] as Stream.Writable; // the fd for this input

    const sink = new AudioSink(audioTrack); // audioTrack.addEventListener?.("ended", stop);
    sink.ondata = ({ samples, sampleRate: sr, channelCount: ch, bitsPerSample, numberOfFrames }: RTCAudioData) => {
        // Ensure format is s16le, 48k, mono. Downmix/resample if needed.
        if (sr !== STREAM_INPUT_SAMPLE_RATE_IN_HZ || ch !== 1 || bitsPerSample !== 16) {
            // For production: do resample/downmix here or reject frames.
            return;
        }
        // samples is Int16Array; write its underlying bytes
        try {
            let totalWritten = 0;
            const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
            const ok = writer?.write(buf);
            if (ok) totalWritten += buf.length;
            console.log(`Wrote ${totalWritten} bytes of audio data`);
        } catch (error) {
            console.error(`Error writing audio data:`, error);
        }
    };

    const stop = () => {
        try {
            sink.stop();
        } catch {}
        try {
            writer?.end();
        } catch {}
    };

    return { sink, writer, stop };
}

export function stopFFmpegProcess(ffmpegProcess: ChildProcessWithoutNullStreams, audioSource: NodeJS.WritableStream) {
    if (ffmpegProcess && !ffmpegProcess.killed) {
        ffmpegProcess.stdout.unpipe(audioSource);
        ffmpegProcess.kill();
    }
}
