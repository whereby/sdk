import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import Stream, { Writable } from "stream";
import wrtc from "@roamhq/wrtc";
import { AudioSink } from "./AudioEndpoints";

// Number of pipes in the ffmpeg process. We predefine a fixed number of slots, and then we dynamically assign
// participants/screenshares to these slots based on mute/unmute state.
export const MIXER_SLOTS = 20;
// Each sample is 2 bytes (16 bits) for PCM audio - s16le format
// 48000 Hz is the standard sample rate for WebRTC audio
const STREAM_INPUT_SAMPLE_RATE_IN_HZ = 48000;
const BYTES_PER_SAMPLE = 2;
// 480 samples per 10ms frame at 48kHz
const FRAME_10MS_SAMPLES = 480;

export function createFfmpegMixer() {
    const slotBuffers: Map<number, Int16Array> = new Map();

    function appendAndDrainTo480(slot: number, newSamples: Int16Array) {
        const prev = slotBuffers.get(slot) ?? new Int16Array(0);

        const merged = new Int16Array(prev.length + newSamples.length);
        merged.set(prev, 0);
        merged.set(newSamples, prev.length);

        let offset = 0;
        while (merged.length - offset >= FRAME_10MS_SAMPLES) {
            const chunk = merged.subarray(offset, offset + FRAME_10MS_SAMPLES);
            enqueueFrame(slot, chunk, FRAME_10MS_SAMPLES); // always 480
            offset += FRAME_10MS_SAMPLES;
        }

        slotBuffers.set(slot, merged.subarray(offset)); // keep remainder
    }

    // Debug: use to get per-slot stats
    const ENABLE_METERS = false;
    const meter = {
        enqFrames: new Array(MIXER_SLOTS).fill(0),
        enqSamples: new Array(MIXER_SLOTS).fill(0),
        wroteFrames: new Array(MIXER_SLOTS).fill(0),
        wroteSamples: new Array(MIXER_SLOTS).fill(0),
        lastFramesSeen: new Array(MIXER_SLOTS).fill(0),
    };
    if (ENABLE_METERS) {
        setInterval(() => {
            for (let s = 0; s < MIXER_SLOTS; s++) {
                // eslint-disable-next-line no-console
                console.log(
                    `[slot ${s}] enqF=${meter.enqFrames[s]}/s enqS=${meter.enqSamples[s]} ` +
                        `wroteF=${meter.wroteFrames[s]}/s wroteS=${meter.wroteSamples[s]} ` +
                        `lastFrames=${meter.lastFramesSeen[s]}`,
                );
                meter.enqFrames[s] = meter.enqSamples[s] = meter.wroteFrames[s] = meter.wroteSamples[s] = 0;
            }
        }, 1000);
    }

    type SlotState = { q: Buffer[]; lastFrames: number; nextDueMs: number };
    let slots: SlotState[] = [];
    let stopPacerFn: (() => void) | null = null;

    type OutputPacerState = {
        frameQueue: Int16Array[];
        nextDueMs: number;
        rtcAudioSource: wrtc.nonstandard.RTCAudioSource;
    };
    let outputPacerState: OutputPacerState | null = null;

    /**
     * Simple linear interpolation resampler to convert audio to 48kHz.
     * This handles the common case of 16kHz -> 48kHz (3x upsampling).
     */
    function resampleTo48kHz(inputSamples: Int16Array, inputSampleRate: number, inputFrames: number): Int16Array {
        const ratio = STREAM_INPUT_SAMPLE_RATE_IN_HZ / inputSampleRate;
        const outputLength = Math.floor(inputFrames * ratio);
        const output = new Int16Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
            const inputIndex = i / ratio;
            const index = Math.floor(inputIndex);
            const fraction = inputIndex - index;

            if (index + 1 < inputSamples.length) {
                const sample1 = inputSamples[index];
                const sample2 = inputSamples[index + 1];
                output[i] = Math.round(sample1 + (sample2 - sample1) * fraction);
            } else {
                output[i] = inputSamples[Math.min(index, inputSamples.length - 1)];
            }
        }

        return output;
    }

    /**
     * Enqueue an audio frame for paced delivery to the RTCAudioSource.
     */
    function enqueueOutputFrame(samples: Int16Array) {
        if (outputPacerState) {
            outputPacerState.frameQueue.push(samples);
        }
    }

    /**
     * Start the audio pacer loop for all input slots in an FFmpeg process.
     *
     * The pacer ensures each slot (pipe:3..3+N-1) is written to at a steady
     * real-time rate (e.g. 10 ms = 480 samples @ 48kHz), even if WebRTC frames
     * arrive jittery, bursty, or with slightly different clocks.
     *
     * Key behavior:
     * - Writes exactly one frame per period, on a shared wall-clock grid.
     * - Uses silence (zero-filled frame) if a slot's queue is empty, so timing
     *   never stalls.
     * - Resnaps the schedule if a slot switches between 10 ms / 20 ms frames.
     * - Honors Node stream backpressure (`write()` return false) without breaking
     *   the timing grid.
     *
     * This keeps all FFmpeg inputs phase-aligned and stable, so aresample/amix
     * can mix them without slow-downs or drift.
     *
     * Call this once right after spawning FFmpeg:
     * ```ts
     * const ff = spawnFFmpegProcess();
     * startPacer(ff, MIXER_SLOTS);
     * ```
     *
     * When tearing down the mixer, always call `stopPacer()` before killing FFmpeg.
     *
     * @param ff        Child process handle from spawn("ffmpeg", ...)
     * @param slotCount Number of mixer input slots (0..N-1 → fd 3..3+N-1)
     */
    function startPacer(
        ff: ChildProcessWithoutNullStreams,
        slotCount: number,
        rtcAudioSource: wrtc.nonstandard.RTCAudioSource,
    ) {
        if (stopPacerFn) {
            stopPacerFn();
            stopPacerFn = null;
        }

        const writers: Writable[] = Array.from({ length: slotCount }, (_, i) => ff.stdio[3 + i] as Writable);
        const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
        const outputFrameMs = (FRAME_10MS_SAMPLES / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000; // 10ms
        const t0 = nowMs();

        slots = Array.from({ length: slotCount }, () => ({
            q: [],
            lastFrames: FRAME_10MS_SAMPLES, // keep constant
            nextDueMs: t0 + (FRAME_10MS_SAMPLES / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000,
        }));

        outputPacerState = {
            frameQueue: [],
            nextDueMs: t0 + outputFrameMs,
            rtcAudioSource,
        };

        const iv = setInterval(() => {
            const t = nowMs();

            for (let s = 0; s < slotCount; s++) {
                const st = slots[s];
                const w = writers[s];

                const frameMs = (st.lastFrames / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000; // 10ms if 480, 20ms if 960

                if (t >= st.nextDueMs) {
                    const buf = st.q.length ? st.q.shift() : Buffer.alloc(st.lastFrames * BYTES_PER_SAMPLE);

                    if (!w.write(buf)) {
                        // Just continue without adding drain listener - backpressure will naturally resolve
                        const late = t - st.nextDueMs;
                        const steps = Math.max(1, Math.ceil(late / frameMs));
                        st.nextDueMs += steps * frameMs;
                        continue;
                    }

                    const late = t - st.nextDueMs;
                    const steps = Math.max(1, Math.ceil(late / frameMs));
                    st.nextDueMs += steps * frameMs;

                    if (ENABLE_METERS) {
                        meter.wroteFrames[s] += 1;
                        meter.wroteSamples[s] += st.lastFrames;
                    }
                }
            }

            if (!outputPacerState) return;
            // Handle output pacer for RTCAudioSource
            const state = outputPacerState;

            if (t >= state.nextDueMs) {
                const samples =
                    state.frameQueue.length > 0 ? state.frameQueue.shift()! : new Int16Array(FRAME_10MS_SAMPLES); // silence

                state.rtcAudioSource.onData({
                    samples: samples,
                    sampleRate: STREAM_INPUT_SAMPLE_RATE_IN_HZ,
                });

                const late = t - state.nextDueMs;
                const steps = Math.max(1, Math.ceil(late / outputFrameMs));
                state.nextDueMs += steps * outputFrameMs;
            }
        }, 5);

        stopPacerFn = () => clearInterval(iv);
    }

    /**
     * Stop the audio pacer loop and clear all input slots.
     * Call this before killing the FFmpeg process to ensure clean shutdown.
     */
    function stopPacer() {
        if (stopPacerFn) stopPacerFn();
        stopPacerFn = null;
        slots = [];
        slotBuffers.clear();
        outputPacerState = null;
    }

    /**
     * Queue a live frame for a given slot (0..N-1).
     * Auto-resnaps the slot's schedule if the frame size (480/960) changes.
     */
    function enqueueFrame(slot: number, samples: Int16Array, numberOfFrames: number) {
        const st = slots[slot];
        if (!st) return;

        const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
        st.q.push(buf);

        if (ENABLE_METERS) {
            meter.lastFramesSeen[slot] = numberOfFrames;
            meter.enqFrames[slot] += 1;
            meter.enqSamples[slot] += numberOfFrames;
        }
    }

    /**
     * Clear the audio queue for a specific slot when a participant leaves or screenshare stops.
     * This prevents stale audio data from continuing to play after disconnect.
     */
    function clearSlotQueue(slot: number) {
        const st = slots[slot];
        if (st) {
            st.q = [];
            slotBuffers.delete(slot);
            const now = Number(process.hrtime.bigint()) / 1e6;
            const frameMs = (st.lastFrames / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000;
            st.nextDueMs = now + frameMs;
        }
    }

    /**
     * Get the FFmpeg arguments for debugging, which writes each participant/screenshare's audio to a separate WAV file
     * and also mixes them into a single WAV file.
     * This is useful for inspecting the audio quality and timing of each participant/screenshare.
     */
    function getFFmpegArgumentsDebug() {
        const N = MIXER_SLOTS;
        const SR = STREAM_INPUT_SAMPLE_RATE_IN_HZ;
        const ffArgs: string[] = [];

        for (let i = 0; i < N; i++) {
            ffArgs.push("-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", `pipe:${3 + i}`);
        }

        const pre: string[] = [];
        for (let i = 0; i < N; i++) {
            pre.push(`[${i}:a]aresample=async=0:first_pts=0,asetpts=PTS-STARTPTS,asplit=2[a${i}tap][a${i}mix]`);
        }
        const mixInputs = Array.from({ length: N }, (_, i) => `[a${i}mix]`).join("");
        const filter = `${pre.join(";")};${mixInputs}amix=inputs=${N}:duration=first:dropout_transition=0:normalize=0[mix]`;

        ffArgs.push("-hide_banner", "-nostats", "-loglevel", "info", "-y", "-filter_complex", filter);

        for (let i = 0; i < N; i++) {
            ffArgs.push("-map", `[a${i}tap]`, "-f", "wav", "-c:a", "pcm_s16le", `pre${i}.wav`);
        }
        ffArgs.push("-map", "[mix]", "-f", "wav", "-c:a", "pcm_s16le", "mixed.wav");

        return ffArgs;
    }

    /**
     * Get the FFmpeg arguments for mixing audio from multiple participants/screenshares.
     * This will read from the input pipes (3..3+N-1) and output a single mixed audio stream.
     * The output is in PCM 16-bit little-endian format at 48kHz sample rate.
     */
    function getFFmpegArguments() {
        const N = MIXER_SLOTS;
        const SR = STREAM_INPUT_SAMPLE_RATE_IN_HZ;
        const ffArgs: string[] = [];

        for (let i = 0; i < N; i++) {
            ffArgs.push("-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", `pipe:${3 + i}`);
        }

        const pre: string[] = [];
        for (let i = 0; i < N; i++) {
            pre.push(`[${i}:a]aresample=async=0:first_pts=0,asetpts=PTS-STARTPTS[a${i}]`);
        }
        const labels = Array.from({ length: N }, (_, i) => `[a${i}]`).join("");
        const amix = `${labels}amix=inputs=${N}:duration=first:dropout_transition=0:normalize=0[mix]`;
        const filter = `${pre.join(";")};${amix}`;

        ffArgs.push(
            "-hide_banner",
            "-nostats",
            "-loglevel",
            "error",
            "-filter_complex",
            filter,
            "-map",
            "[mix]",
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

        return ffArgs;
    }

    /*
     * Spawn a new FFmpeg process for debugging purposes.
     * This will write each participant/screenshare's audio to a separate WAV file and also mix them into a single WAV file.
     * The output files will be named pre0.wav, pre1.wav, ..., and mixed.wav.
     * The process will log its output to stderr.
     * @return The spawned FFmpeg process.
     */
    function spawnFFmpegProcessDebug(rtcAudioSource: wrtc.nonstandard.RTCAudioSource) {
        const stdio = ["ignore", "ignore", "pipe", ...Array(MIXER_SLOTS).fill("pipe")];
        const args = getFFmpegArgumentsDebug();
        const ffmpegProcess = spawn("ffmpeg", args, { stdio });

        startPacer(ffmpegProcess, MIXER_SLOTS, rtcAudioSource);

        ffmpegProcess.stderr.setEncoding("utf8");
        ffmpegProcess.stderr.on("data", (d) => console.error("[ffmpeg]", String(d).trim()));
        ffmpegProcess.on("error", () => console.error("FFmpeg process error (debug): is ffmpeg installed?"));

        return ffmpegProcess;
    }

    /**
     * Spawn a new FFmpeg process for mixing audio from multiple participants/screenshares.
     * This will read from the input pipes (3..3+N-1) and output a single mixed audio stream.
     * The output is in PCM 16-bit little-endian format at 48kHz sample rate.
     * The process will log its output to stderr.
     * @param rtcAudioSource The RTCAudioSource to which the mixed audio will be sent.
     * @return The spawned FFmpeg process.
     */
    function spawnFFmpegProcess(rtcAudioSource: wrtc.nonstandard.RTCAudioSource) {
        const stdio = ["pipe", "pipe", "pipe", ...Array(MIXER_SLOTS).fill("pipe")];
        const args = getFFmpegArguments();
        const ffmpegProcess = spawn("ffmpeg", args, { stdio });

        startPacer(ffmpegProcess, MIXER_SLOTS, rtcAudioSource);

        ffmpegProcess.stderr.setEncoding("utf8");
        ffmpegProcess.stderr.on("data", (d) => console.error("[ffmpeg]", String(d).trim()));
        ffmpegProcess.on("error", () => console.error("FFmpeg process error: is ffmpeg installed?"));
        let audioBuffer = Buffer.alloc(0);
        const FRAME_SIZE_BYTES = FRAME_10MS_SAMPLES * BYTES_PER_SAMPLE; // 480 samples * 2 bytes = 960 bytes

        ffmpegProcess.stdout.on("data", (chunk: Buffer) => {
            audioBuffer = Buffer.concat([audioBuffer, chunk]);

            while (audioBuffer.length >= FRAME_SIZE_BYTES) {
                const frameData = audioBuffer.subarray(0, FRAME_SIZE_BYTES);
                const samples = new Int16Array(FRAME_10MS_SAMPLES);

                for (let i = 0; i < FRAME_10MS_SAMPLES; i++) {
                    samples[i] = frameData.readInt16LE(i * 2);
                }

                enqueueOutputFrame(samples);
                audioBuffer = audioBuffer.subarray(FRAME_SIZE_BYTES);
            }
        });

        return ffmpegProcess;
    }

    /**
     * Write audio data from a MediaStreamTrack to the FFmpeg process.
     * This function creates an AudioSink for the track and sets up a data handler
     * that enqueues audio frames into the pacer.
     *
     * @param ffmpegProcess The FFmpeg process to which audio data will be written.
     * @param slot The mixer slot number (0..N-1) to which this track belongs.
     * @param audioTrack The MediaStreamTrack containing the audio data.
     * @return An object containing the AudioSink, the writable stream, and a stop function.
     */
    function writeAudioDataToFFmpeg(
        ffmpegProcess: ChildProcessWithoutNullStreams,
        slot: number,
        audioTrack: wrtc.MediaStreamTrack,
    ) {
        const writer = ffmpegProcess.stdio[3 + slot] as Stream.Writable;

        const sink = new AudioSink(audioTrack);
        const unsubscribe = sink.subscribe(
            ({ samples, sampleRate: sr, channelCount: ch, bitsPerSample, numberOfFrames }) => {
                if (ch !== 1 || bitsPerSample !== 16) return;

                let out = samples;
                if (sr !== STREAM_INPUT_SAMPLE_RATE_IN_HZ) {
                    const resampled = resampleTo48kHz(samples, sr, numberOfFrames ?? samples.length);
                    out = resampled;
                }

                appendAndDrainTo480(slot, out);
            },
        );

        const stop = () => {
            try {
                unsubscribe();
                sink.stop();
            } catch {
                console.error("Failed to stop AudioSink");
            }
        };
        return { sink, writer, stop };
    }

    /**
     * Stop the FFmpeg process and clean up all resources.
     * This function will unpipe the stdout, end all writable streams for each mixer slot,
     * and kill the FFmpeg process.
     * @param ffmpegProcess The FFmpeg process to stop.
     */
    function stopFFmpegProcess(ffmpegProcess: ChildProcessWithoutNullStreams) {
        stopPacer();
        if (!ffmpegProcess || ffmpegProcess.exitCode !== null) {
            return;
        }

        try {
            ffmpegProcess.stdout.unpipe();
        } catch {
            console.error("Failed to unpipe ffmpeg stdout");
        }
        for (let i = 0; i < MIXER_SLOTS; i++) {
            const w = ffmpegProcess.stdio[3 + i] as Stream.Writable;
            try {
                w.end();
                w.destroy();
            } catch {
                console.error("Failed to end ffmpeg writable stream");
            }
        }
        try {
            ffmpegProcess.stdout?.destroy?.();
        } catch {
            // noop as we are tearing down
        }

        try {
            ffmpegProcess.stderr?.destroy?.();
        } catch {
            // noop as we are tearing down
        }

        try {
            ffmpegProcess.stdin?.end();
        } catch {
            console.error("Failed to end ffmpeg stdin");
        }
        ffmpegProcess.kill("SIGTERM");

        const t = setTimeout(() => {
            if (ffmpegProcess.exitCode == null) {
                try {
                    ffmpegProcess.kill("SIGKILL");
                } catch {
                    // noop since we are tearing down
                }
            }
        }, 2000);

        ffmpegProcess.once("exit", () => clearTimeout(t));
    }
    return {
        spawnFFmpegProcess,
        spawnFFmpegProcessDebug,
        writeAudioDataToFFmpeg,
        stopFFmpegProcess,
        clearSlotQueue,
    };
}
