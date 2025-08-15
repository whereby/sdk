import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import fs, { write } from "fs";
import Stream from "stream";
import wrtc from "@roamhq/wrtc";
import { AudioSink } from "./AudioSink";
import { RTCAudioData } from "@roamhq/wrtc/types/nonstandard";

export const STREAM_INPUT_SAMPLE_RATE_IN_HZ = 48000;
export const PARTICIPANT_SLOTS = 2;

export const writers: Map<number, { writer: Stream.Writable; stop: () => void }> = new Map();

export function getFFmpegArguments() {
    const N = PARTICIPANT_SLOTS;
    const SR = STREAM_INPUT_SAMPLE_RATE_IN_HZ;

    const ffArgs: string[] = [];

    // 1) Inputs
    for (let i = 0; i < N; i++) {
        ffArgs.push("-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", `pipe:${3 + i}`);
    }

    // 2) Filter graph: per-input aresample + amix
    const pre: string[] = [];
    for (let i = 0; i < N; i++) {
        pre.push(`[${i}:a]aresample=async=1:first_pts=0[a${i}]`);
    }
    const labels = Array.from({ length: N }, (_, i) => `[a${i}]`).join("");
    const amix = `${labels}amix=inputs=${N}:duration=longest:dropout_transition=250:normalize=1[mix]`;
    const filter = `${pre.join(";")};${amix}`;

    // 3) Filters + mapping
    ffArgs.push(
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-filter_complex",
        filter, // <-- SINGLE ARG!
        "-map",
        "[mix]", // <-- map mixed stream
        // 4) Output options + output
        "-f",
        "s16le",
        "-ar",
        String(SR),
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        "pipe:1",
    );

    // Helpful during debug:
    console.log("ffmpeg argv:\n", ffArgs.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" "));

    return ffArgs;
}

export function spawnFFmpegProcess(audioSource: NodeJS.WritableStream) {
    const stdio = ["ignore", "pipe", "inherit", ...Array(PARTICIPANT_SLOTS).fill("pipe")];
    const args = getFFmpegArguments();

    const ffmpegProcess = spawn("ffmpeg", args, { stdio });
    for (let i = 0; i < PARTICIPANT_SLOTS; i++) {
        feedSilenceForever(i + 3, ffmpegProcess); // Start feeding silence to each input
    }
    ffmpegProcess.on("error", () => {
        console.error("FFmpeg process error: FFmpeg is not installed");
    });

    console.log("Piping into output.pcm");
    const out = fs.createWriteStream("./output.pcm");
    ffmpegProcess.stdout.pipe(audioSource);
    ffmpegProcess.stdout.pipe(out);
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
    const writer = ffmpegProcess!.stdio[inputIndex] as Stream.Writable; // the fd for this input

    const sink = new AudioSink(audioTrack); // audioTrack.addEventListener?.("ended", stop);
    const silenceWriter = writers.get(inputIndex);
    if (silenceWriter) {
        silenceWriter.stop(); // Stop feeding silence if it was already running
    }
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
            if (!writer || !writer.writable || writer.writableEnded) {
                console.warn(`FFmpeg input ${inputIndex} is not writable. Skipping write.`);
                return;
            }
            const ok = writer?.write(buf);
            if (ok) totalWritten += buf.length;
            // console.log(`Wrote ${totalWritten} bytes to FFmpeg input ${inputIndex}`);
        } catch (error) {
            console.error(`Error writing audio data:`, error);
        }
    };

    const stop = () => {
        try {
            sink.stop();
        } catch {}
        try {
            feedSilenceForever(inputIndex, ffmpegProcess);
        } catch {}
    };

    return { sink, writer, stop };
}

export function stopFFmpegProcess(ffmpegProcess: ChildProcessWithoutNullStreams, audioSource: NodeJS.WritableStream) {
    console.log("Stopping FFmpeg process and audio source");
    if (ffmpegProcess && !ffmpegProcess.killed) {
        ffmpegProcess.stdout.unpipe(audioSource);
        ffmpegProcess.kill();
        for (let i = 0; i < PARTICIPANT_SLOTS; i++) {
            const writer = ffmpegProcess!.stdio[i + 3] as Stream.Writable; // the fd for this input
            if (writers.has(i + 3)) {
                const silenceWriter = writers.get(i + 3);
                silenceWriter?.stop(); // Stop feeding silence
                writers.delete(i + 3);
            }
            writer.end();
        }
    }
}

export function feedSilenceForever(index: number, ffmpegProcess: ChildProcessWithoutNullStreams) {
    const writer = ffmpegProcess.stdio[index] as Stream.Writable;
    if (!writer) {
        console.warn(`No writer found for index ${index}. Cannot feed silence.`);
        return;
    }
    const silenceFrame = Buffer.alloc(480 * 2);

    const interval = setInterval(() => {
        if (writer.writableEnded) {
            clearInterval(interval);
            return;
        }
        writer.write(silenceFrame);
    }, 10); // every 10ms
    writers.set(index, { writer, stop: () => clearInterval(interval) });
    return () => clearInterval(interval);
}
