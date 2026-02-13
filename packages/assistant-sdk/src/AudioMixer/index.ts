import type { ChildProcessWithoutNullStreams } from "child_process";
import Stream from "stream";
import { EventEmitter } from "events";
import { RemoteParticipantState, ScreenshareState } from "@whereby.com/core";
import { AudioSink } from "../utils/AudioEndpoints";
import { MIXER_SLOTS, createFfmpegMixer } from "../utils/ffmpeg-helpers";

import wrtc from "@roamhq/wrtc";

type MixableType = "screenshare" | "participant";
type SlotBinding = {
    sink: AudioSink;
    writer: Stream.Writable;
    stop: () => void;
    trackId: string;
    type: MixableType;
};

// Debug: set to true to enable debug output (and write audio to .wav files)
const DEBUG_MIXER_OUTPUT = process.env.DEBUG_MIXER_OUTPUT ?? false;

export class AudioMixer extends EventEmitter {
    private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
    private combinedAudioStream: MediaStream | null = null;
    private rtcAudioSource: wrtc.nonstandard.RTCAudioSource | null = null;
    private mixableSlots = new Map<number, string>();
    private activeSlots: Record<number, SlotBinding | undefined> = {};
    private mixer = createFfmpegMixer();

    constructor() {
        super();
        this.setupMediaStream();
        this.mixableSlots = new Map(Array.from({ length: MIXER_SLOTS }, (_, i) => [i, ""]));
    }

    private setupMediaStream(): void {
        this.rtcAudioSource = new wrtc.nonstandard.RTCAudioSource();

        const audioTrack = this.rtcAudioSource.createTrack();
        this.combinedAudioStream = new wrtc.MediaStream([audioTrack]);
    }

    private slotForMixable(mixableId: string): number | null {
        const found = [...this.mixableSlots.entries()].find(([, id]) => id === mixableId)?.[0];
        return found === undefined ? null : found;
    }

    private slotsByType(mixableType: MixableType) {
        return [...this.mixableSlots.entries()].filter(([slotId]) => this.activeSlots[slotId]?.type === mixableType);
    }

    private acquireSlot(mixableId: string): number | null {
        const existing = this.slotForMixable(mixableId);
        if (existing !== null) return existing;

        const empty = [...this.mixableSlots.entries()].find(([, id]) => id === "")?.[0];
        if (empty === undefined) return null;

        this.mixableSlots.set(empty, mixableId);
        return empty;
    }

    private attachMixableIfNeeded(mixable: {
        id: string;
        stream?: wrtc.MediaStream | null;
        isAudioEnabled: boolean;
        type: MixableType;
    }): void {
        const { id: mixableId, stream: mixableStream, isAudioEnabled, type } = mixable;
        if (!mixableId) return;

        if (!mixableStream || !isAudioEnabled) {
            this.detachMixable(mixableId);
            return;
        }

        const audioTrack = mixableStream.getTracks().find((t) => t.kind === "audio");
        if (!audioTrack) {
            this.detachMixable(mixableId);
            return;
        }

        const slot = this.acquireSlot(mixableId);
        if (slot === null) return;

        const existing = this.activeSlots[slot];
        if (existing && existing.trackId === audioTrack.id) return;
        if (existing) {
            try {
                existing.stop();
            } catch (e) {
                console.error("Failed to stop existing audio track", { error: e });
            }
            this.activeSlots[slot] = undefined;
        }

        const { sink, writer, stop } = this.mixer.writeAudioDataToFFmpeg(this.ffmpegProcess!, slot, audioTrack);
        this.activeSlots[slot] = { sink, writer, stop, trackId: audioTrack.id, type };

        audioTrack.addEventListener?.("ended", () => this.detachMixable(mixableId));
    }

    private detachMixable(mixableId: string): void {
        const slot = this.slotForMixable(mixableId);
        if (slot === null) return;

        const binding = this.activeSlots[slot];
        if (binding) {
            try {
                binding.stop();
            } catch (e) {
                console.error("Failed to stop existing audio track", { error: e });
            }
            this.activeSlots[slot] = undefined;
        }

        // Clear any queued audio data for this slot to prevent stale audio
        this.mixer.clearSlotQueue(slot);
        this.mixableSlots.set(slot, "");
    }

    public getCombinedAudioStream(): MediaStream | null {
        return this.combinedAudioStream;
    }

    public handleRemoteParticipants(participants: RemoteParticipantState[]): void {
        const liveIds = new Set(participants.map((p) => p.id).filter(Boolean) as string[]);
        const typedSlots = this.slotsByType("participant");

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [slot, pid] of typedSlots) {
            if (pid && !liveIds.has(pid)) this.detachMixable(pid);
        }

        if (!this.ffmpegProcess && this.rtcAudioSource) {
            this.ffmpegProcess = DEBUG_MIXER_OUTPUT
                ? this.mixer.spawnFFmpegProcessDebug(this.rtcAudioSource)
                : this.mixer.spawnFFmpegProcess(this.rtcAudioSource);
        }

        for (const p of participants) this.attachMixableIfNeeded({ ...p, type: "participant" });
    }

    public handleScreenshares(screenshares: ScreenshareState[]): void {
        const screensharesWithAudio = screenshares.filter(
            (screenshare) =>
                screenshare.hasAudioTrack &&
                screenshare.stream &&
                screenshare.stream.getTracks().filter(({ kind }) => kind === "audio").length > 0,
        );
        const liveIds = new Set(screensharesWithAudio.map((p) => p.id).filter(Boolean) as string[]);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [slot, sid] of this.slotsByType("screenshare")) {
            if (sid && !liveIds.has(sid)) this.detachMixable(sid);
        }

        if (screensharesWithAudio.length === 0) {
            return;
        }

        if (!this.ffmpegProcess && this.rtcAudioSource) {
            this.ffmpegProcess = DEBUG_MIXER_OUTPUT
                ? this.mixer.spawnFFmpegProcessDebug(this.rtcAudioSource)
                : this.mixer.spawnFFmpegProcess(this.rtcAudioSource);
        }

        const mixables = screensharesWithAudio.map(({ id, stream, hasAudioTrack }) => ({
            id,
            stream,
            isAudioEnabled: hasAudioTrack,
        }));
        for (const s of mixables) this.attachMixableIfNeeded({ ...s, type: "screenshare" });
    }

    public stopAudioMixer(): void {
        if (this.ffmpegProcess) {
            this.mixer.stopFFmpegProcess(this.ffmpegProcess);
            this.ffmpegProcess = null;
        }
        this.mixableSlots = new Map(Array.from({ length: MIXER_SLOTS }, (_, i) => [i, ""]));
        this.activeSlots = {};
        // Recreate the media stream to avoid stale references
        this.setupMediaStream();
    }
}
