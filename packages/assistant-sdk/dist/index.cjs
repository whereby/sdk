'use strict';

var core = require('@whereby.com/core');
var wrtc = require('@roamhq/wrtc');
var EventEmitter = require('events');
var child_process = require('child_process');
var stream = require('stream');
var express = require('express');
var assert = require('assert');
var bodyParser = require('body-parser');
var os = require('os');

const ASSISTANT_JOIN_SUCCESS = "ASSISTANT_JOIN_SUCCESS";

const AUDIO_STREAM_READY = "AUDIO_STREAM_READY";

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const { nonstandard: { RTCAudioSink }, } = wrtc;
class AudioSource extends stream.PassThrough {
    constructor() {
        super({
            allowHalfOpen: true,
            highWaterMark: 1 * 1024,
        });
    }
}
class AudioSink extends wrtc.nonstandard.RTCAudioSink {
    constructor(track) {
        super(track);
        this._sink = new RTCAudioSink(track);
    }
    subscribe(cb) {
        this._sink.ondata = cb;
        return () => {
            this._sink.ondata = undefined;
        };
    }
}

const PARTICIPANT_SLOTS = 20;
const STREAM_INPUT_SAMPLE_RATE_IN_HZ = 48000;
const BYTES_PER_SAMPLE = 2;
const FRAME_10MS_SAMPLES = 480;
const slotBuffers = new Map();
function appendAndDrainTo480(slot, newSamples) {
    var _a;
    const prev = (_a = slotBuffers.get(slot)) !== null && _a !== void 0 ? _a : new Int16Array(0);
    const merged = new Int16Array(prev.length + newSamples.length);
    merged.set(prev, 0);
    merged.set(newSamples, prev.length);
    let offset = 0;
    while (merged.length - offset >= FRAME_10MS_SAMPLES) {
        const chunk = merged.subarray(offset, offset + FRAME_10MS_SAMPLES);
        enqueueFrame(slot, chunk);
        offset += FRAME_10MS_SAMPLES;
    }
    slotBuffers.set(slot, merged.subarray(offset));
}
({
    enqFrames: new Array(PARTICIPANT_SLOTS).fill(0),
    enqSamples: new Array(PARTICIPANT_SLOTS).fill(0),
    wroteFrames: new Array(PARTICIPANT_SLOTS).fill(0),
    wroteSamples: new Array(PARTICIPANT_SLOTS).fill(0),
    lastFramesSeen: new Array(PARTICIPANT_SLOTS).fill(0),
});
let slots = [];
let stopPacerFn = null;
let outputPacerState = null;
function resampleTo48kHz(inputSamples, inputSampleRate, inputFrames) {
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
        }
        else {
            output[i] = inputSamples[Math.min(index, inputSamples.length - 1)];
        }
    }
    return output;
}
function enqueueOutputFrame(samples) {
    if (outputPacerState) {
        outputPacerState.frameQueue.push(samples);
    }
}
function startPacer(ff, slotCount, rtcAudioSource, onAudioStreamReady) {
    if (stopPacerFn) {
        stopPacerFn();
        stopPacerFn = null;
    }
    const writers = Array.from({ length: slotCount }, (_, i) => ff.stdio[3 + i]);
    const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
    const outputFrameMs = (FRAME_10MS_SAMPLES / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000;
    const t0 = nowMs();
    slots = Array.from({ length: slotCount }, () => ({
        q: [],
        lastFrames: FRAME_10MS_SAMPLES,
        nextDueMs: t0 + (FRAME_10MS_SAMPLES / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000,
    }));
    outputPacerState = {
        frameQueue: [],
        nextDueMs: t0 + outputFrameMs,
        rtcAudioSource,
        onAudioStreamReady,
        didEmitReadyEvent: false,
    };
    const iv = setInterval(() => {
        const t = nowMs();
        for (let s = 0; s < slotCount; s++) {
            const st = slots[s];
            const w = writers[s];
            const frameMs = (st.lastFrames / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000;
            if (t >= st.nextDueMs) {
                const buf = st.q.length ? st.q.shift() : Buffer.alloc(st.lastFrames * BYTES_PER_SAMPLE);
                if (!w.write(buf)) {
                    const late = t - st.nextDueMs;
                    const steps = Math.max(1, Math.ceil(late / frameMs));
                    st.nextDueMs += steps * frameMs;
                    continue;
                }
                const late = t - st.nextDueMs;
                const steps = Math.max(1, Math.ceil(late / frameMs));
                st.nextDueMs += steps * frameMs;
            }
        }
        if (!outputPacerState)
            return;
        const state = outputPacerState;
        if (t >= state.nextDueMs) {
            const samples = state.frameQueue.length > 0 ? state.frameQueue.shift() : new Int16Array(FRAME_10MS_SAMPLES);
            if (!state.didEmitReadyEvent) {
                state.onAudioStreamReady();
                state.didEmitReadyEvent = true;
            }
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
function stopPacer() {
    if (stopPacerFn)
        stopPacerFn();
    stopPacerFn = null;
    slots = [];
}
function enqueueFrame(slot, samples, numberOfFrames) {
    const st = slots[slot];
    if (!st)
        return;
    const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    st.q.push(buf);
}
function clearSlotQueue(slot) {
    const st = slots[slot];
    if (st) {
        st.q = [];
        const now = Number(process.hrtime.bigint()) / 1e6;
        const frameMs = (st.lastFrames / STREAM_INPUT_SAMPLE_RATE_IN_HZ) * 1000;
        st.nextDueMs = now + frameMs;
    }
}
function getFFmpegArguments() {
    const N = PARTICIPANT_SLOTS;
    const SR = STREAM_INPUT_SAMPLE_RATE_IN_HZ;
    const ffArgs = [];
    for (let i = 0; i < N; i++) {
        ffArgs.push("-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", `pipe:${3 + i}`);
    }
    const pre = [];
    for (let i = 0; i < N; i++) {
        pre.push(`[${i}:a]aresample=async=1:first_pts=0,asetpts=N/SR/TB[a${i}]`);
    }
    const labels = Array.from({ length: N }, (_, i) => `[a${i}]`).join("");
    const amix = `${labels}amix=inputs=${N}:duration=longest:dropout_transition=250:normalize=0[mix]`;
    const filter = `${pre.join(";")};${amix}`;
    ffArgs.push("-hide_banner", "-nostats", "-loglevel", "error", "-filter_complex", filter, "-map", "[mix]", "-f", "s16le", "-ar", String(SR), "-ac", "1", "-c:a", "pcm_s16le", "pipe:1");
    return ffArgs;
}
function spawnFFmpegProcess(rtcAudioSource, onAudioStreamReady) {
    const stdio = ["ignore", "pipe", "pipe", ...Array(PARTICIPANT_SLOTS).fill("pipe")];
    const args = getFFmpegArguments();
    const ffmpegProcess = child_process.spawn("ffmpeg", args, { stdio });
    startPacer(ffmpegProcess, PARTICIPANT_SLOTS, rtcAudioSource, onAudioStreamReady);
    ffmpegProcess.stderr.setEncoding("utf8");
    ffmpegProcess.stderr.on("data", (d) => console.error("[ffmpeg]", String(d).trim()));
    ffmpegProcess.on("error", () => console.error("FFmpeg process error: is ffmpeg installed?"));
    let audioBuffer = Buffer.alloc(0);
    const FRAME_SIZE_BYTES = FRAME_10MS_SAMPLES * BYTES_PER_SAMPLE;
    ffmpegProcess.stdout.on("data", (chunk) => {
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
function writeAudioDataToFFmpeg(ffmpegProcess, slot, audioTrack) {
    const writer = ffmpegProcess.stdio[3 + slot];
    const sink = new AudioSink(audioTrack);
    const unsubscribe = sink.subscribe(({ samples, sampleRate: sr, channelCount: ch, bitsPerSample, numberOfFrames }) => {
        if (ch !== 1 || bitsPerSample !== 16)
            return;
        let out = samples;
        if (sr !== STREAM_INPUT_SAMPLE_RATE_IN_HZ) {
            const resampled = resampleTo48kHz(samples, sr, numberOfFrames !== null && numberOfFrames !== void 0 ? numberOfFrames : samples.length);
            out = resampled;
        }
        appendAndDrainTo480(slot, out);
    });
    const stop = () => {
        try {
            unsubscribe();
            sink.stop();
        }
        catch (_a) {
            console.error("Failed to stop AudioSink");
        }
    };
    return { sink, writer, stop };
}
function stopFFmpegProcess(ffmpegProcess) {
    stopPacer();
    if (ffmpegProcess && !ffmpegProcess.killed) {
        try {
            ffmpegProcess.stdout.unpipe();
        }
        catch (_a) {
            console.error("Failed to unpipe ffmpeg stdout");
        }
        for (let i = 0; i < PARTICIPANT_SLOTS; i++) {
            const w = ffmpegProcess.stdio[3 + i];
            try {
                w.end();
            }
            catch (_b) {
                console.error("Failed to end ffmpeg writable stream");
            }
        }
        ffmpegProcess.kill("SIGTERM");
    }
}

class AudioMixer extends EventEmitter.EventEmitter {
    constructor(onStreamReady) {
        super();
        this.ffmpegProcess = null;
        this.combinedAudioStream = null;
        this.rtcAudioSource = null;
        this.participantSlots = new Map();
        this.activeSlots = {};
        this.setupMediaStream();
        this.participantSlots = new Map(Array.from({ length: PARTICIPANT_SLOTS }, (_, i) => [i, ""]));
        this.onStreamReady = onStreamReady;
    }
    setupMediaStream() {
        this.rtcAudioSource = new wrtc.nonstandard.RTCAudioSource();
        const audioTrack = this.rtcAudioSource.createTrack();
        this.combinedAudioStream = new wrtc.MediaStream([audioTrack]);
    }
    getCombinedAudioStream() {
        return this.combinedAudioStream;
    }
    handleRemoteParticipants(participants) {
        if (participants.length === 0) {
            this.stopAudioMixer();
            return;
        }
        if (!this.ffmpegProcess) {
            this.ffmpegProcess = spawnFFmpegProcess(this.rtcAudioSource, this.onStreamReady);
        }
        for (const p of participants)
            this.attachParticipantIfNeeded(p);
        const liveIds = new Set(participants.map((p) => p.id).filter(Boolean));
        for (const [slot, pid] of this.participantSlots) {
            if (pid && !liveIds.has(pid))
                this.detachParticipant(pid);
        }
    }
    stopAudioMixer() {
        if (this.ffmpegProcess) {
            stopFFmpegProcess(this.ffmpegProcess);
            this.ffmpegProcess = null;
        }
        this.participantSlots = new Map(Array.from({ length: PARTICIPANT_SLOTS }, (_, i) => [i, ""]));
        this.activeSlots = {};
        this.setupMediaStream();
    }
    slotForParticipant(participantId) {
        var _a;
        const found = (_a = [...this.participantSlots.entries()].find(([, id]) => id === participantId)) === null || _a === void 0 ? void 0 : _a[0];
        return found === undefined ? null : found;
    }
    acquireSlot(participantId) {
        var _a;
        const existing = this.slotForParticipant(participantId);
        if (existing !== null)
            return existing;
        const empty = (_a = [...this.participantSlots.entries()].find(([, id]) => id === "")) === null || _a === void 0 ? void 0 : _a[0];
        if (empty === undefined)
            return null;
        this.participantSlots.set(empty, participantId);
        return empty;
    }
    attachParticipantIfNeeded(participant) {
        var _a;
        const { id: participantId, stream: participantStream, isAudioEnabled } = participant;
        if (!participantId)
            return;
        if (!participantStream || !isAudioEnabled) {
            this.detachParticipant(participantId);
            return;
        }
        const audioTrack = participantStream.getTracks().find((t) => t.kind === "audio");
        if (!audioTrack) {
            this.detachParticipant(participantId);
            return;
        }
        const slot = this.acquireSlot(participantId);
        if (slot === null)
            return;
        const existing = this.activeSlots[slot];
        if (existing && existing.trackId === audioTrack.id)
            return;
        if (existing) {
            try {
                existing.stop();
            }
            catch (e) {
                console.error("Failed to stop existing audio track", { error: e });
            }
            this.activeSlots[slot] = undefined;
        }
        const { sink, writer, stop } = writeAudioDataToFFmpeg(this.ffmpegProcess, slot, audioTrack);
        this.activeSlots[slot] = { sink, writer, stop, trackId: audioTrack.id };
        (_a = audioTrack.addEventListener) === null || _a === void 0 ? void 0 : _a.call(audioTrack, "ended", () => this.detachParticipant(participantId));
    }
    detachParticipant(participantId) {
        const slot = this.slotForParticipant(participantId);
        if (slot === null)
            return;
        const binding = this.activeSlots[slot];
        if (binding) {
            try {
                binding.stop();
            }
            catch (e) {
                console.error("Failed to stop existing audio track", { error: e });
            }
            this.activeSlots[slot] = undefined;
        }
        clearSlotQueue(slot);
        this.participantSlots.set(slot, "");
    }
}

class Assistant extends EventEmitter {
    constructor({ assistantKey, startCombinedAudioStream } = { startCombinedAudioStream: false }) {
        super();
        this.mediaStream = null;
        this.audioSource = null;
        this.combinedStream = null;
        this.assistantKey = assistantKey;
        this.client = new core.WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();
        const outputAudioSource = new wrtc.nonstandard.RTCAudioSource();
        const outputMediaStream = new wrtc.MediaStream([outputAudioSource.createTrack()]);
        this.mediaStream = outputMediaStream;
        this.audioSource = outputAudioSource;
        if (startCombinedAudioStream) {
            const handleStreamReady = () => {
                this.emit(AUDIO_STREAM_READY, {
                    stream: this.combinedStream,
                    track: this.combinedStream.getAudioTracks()[0],
                });
            };
            const audioMixer = new AudioMixer(handleStreamReady);
            this.combinedStream = audioMixer.getCombinedAudioStream();
            this.roomConnection.subscribeToRemoteParticipants(audioMixer.handleRemoteParticipants.bind(audioMixer));
        }
    }
    joinRoom(roomUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.mediaStream) {
                yield this.localMedia.startMedia(this.mediaStream);
            }
            this.roomConnection.initialize({
                localMediaOptions: {
                    audio: false,
                    video: false,
                },
                roomUrl,
                isNodeSdk: true,
                roomKey: this.assistantKey,
            });
            this.roomConnection.joinRoom();
        });
    }
    getLocalMediaStream() {
        return this.mediaStream;
    }
    getLocalAudioSource() {
        return this.audioSource;
    }
    getRoomConnection() {
        return this.roomConnection;
    }
    getCombinedAudioStream() {
        return this.combinedStream;
    }
    getRemoteParticipants() {
        return this.roomConnection.getState().remoteParticipants;
    }
    startCloudRecording() {
        this.roomConnection.startCloudRecording();
    }
    stopCloudRecording() {
        this.roomConnection.stopCloudRecording();
    }
    sendChatMessage(message) {
        this.roomConnection.sendChatMessage(message);
    }
    spotlightParticipant(participantId) {
        this.roomConnection.spotlightParticipant(participantId);
    }
    removeSpotlight(participantId) {
        this.roomConnection.removeSpotlight(participantId);
    }
    requestAudioEnable(participantId, enable) {
        if (enable) {
            this.roomConnection.askToSpeak(participantId);
        }
        else {
            this.roomConnection.muteParticipants([participantId]);
        }
    }
    requestVideoEnable(participantId, enable) {
        if (enable) {
            this.roomConnection.askToTurnOnCamera(participantId);
        }
        else {
            this.roomConnection.turnOffParticipantCameras([participantId]);
        }
    }
    acceptWaitingParticipant(participantId) {
        this.roomConnection.acceptWaitingParticipant(participantId);
    }
    rejectWaitingParticipant(participantId) {
        this.roomConnection.rejectWaitingParticipant(participantId);
    }
    subscribeToRemoteParticipants(callback) {
        return this.roomConnection.subscribeToRemoteParticipants(callback);
    }
}

const BIND_INTERFACE = "en0";
function buildRoomUrl(roomPath, wherebySubdomain, baseDomain = "whereby.com") {
    let wherebyDomain;
    {
        const ifaceAddrs = os.networkInterfaces()[BIND_INTERFACE];
        if (!ifaceAddrs) {
            throw new Error(`Unknown interface ${BIND_INTERFACE}`);
        }
        const [bindAddr] = ifaceAddrs.filter((iface) => iface.family === "IPv4");
        if (!bindAddr) {
            throw new Error(`No IPv4 address found for interface ${BIND_INTERFACE}`);
        }
        wherebyDomain = `${wherebySubdomain}-ip-${bindAddr.address.replace(/[.]/g, "-")}.hereby.dev:4443`;
    }
    return `https://${wherebyDomain}${roomPath}`;
}

const webhookRouter = (webhookTriggers, subdomain, emitter) => {
    const router = express.Router();
    const jsonParser = bodyParser.json();
    router.get("/", (_, res) => {
        res.status(200);
        res.end();
    });
    router.post("/", jsonParser, (req, res) => {
        var _a;
        assert(req.body, "message body is required");
        assert("type" in req.body, "webhook type is required");
        const shouldTriggerOnReceivedWebhook = (_a = webhookTriggers[req.body.type]) === null || _a === void 0 ? void 0 : _a.call(webhookTriggers, req.body);
        if (shouldTriggerOnReceivedWebhook) {
            const roomUrl = buildRoomUrl(req.body.data.roomName, subdomain);
            const assistant = new Assistant({ startCombinedAudioStream: true });
            assistant.joinRoom(roomUrl);
            emitter.emit(ASSISTANT_JOIN_SUCCESS, { roomUrl, triggerWebhook: req.body, assistant });
        }
        res.status(200);
        res.end();
    });
    return router;
};
class Trigger extends EventEmitter.EventEmitter {
    constructor({ webhookTriggers = {}, subdomain, port = 4999 }) {
        super();
        this.webhookTriggers = webhookTriggers;
        this.subdomain = subdomain;
        this.port = port;
    }
    start() {
        const app = express();
        const router = webhookRouter(this.webhookTriggers, this.subdomain, this);
        app.use(router);
        const server = app.listen(this.port, () => {
        });
        process.on("SIGTERM", () => {
            server.close();
        });
    }
}

exports.ASSISTANT_JOIN_SUCCESS = ASSISTANT_JOIN_SUCCESS;
exports.AUDIO_STREAM_READY = AUDIO_STREAM_READY;
exports.Assistant = Assistant;
exports.AudioSink = AudioSink;
exports.AudioSource = AudioSource;
exports.Trigger = Trigger;
