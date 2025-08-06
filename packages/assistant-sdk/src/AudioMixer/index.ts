import type { ChildProcessWithoutNullStreams } from "child_process";
import Stream from "stream";
import { EventEmitter } from "events";
import { RemoteParticipantState } from "@whereby.com/core";
import { AudioSink } from "../utils/AudioSink";
import {
    PARTICIPANT_SLOTS,
    spawnFFmpegProcess,
    spawnFFmpegProcessDebug,
    stopFFmpegProcess,
    writeAudioDataToFFmpeg,
    clearSlotQueue,
} from "../utils/ffmpeg-helpers";

import wrtc from "@roamhq/wrtc";

type SlotBinding = { sink: AudioSink; writer: Stream.Writable; stop: () => void; trackId: string };

// Debug: set to true to enable debug output (and write audio to .wav files)
const DEBUG_MIXER_OUTPUT = false;

export class AudioMixer extends EventEmitter {
    private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
    private combinedAudioStream: MediaStream | null = null;
    private rtcAudioSource: wrtc.nonstandard.RTCAudioSource | null = null;
    private participantSlots = new Map<number, string>();
    private activeSlots: Record<number, SlotBinding | undefined> = {};
    private onStreamReady: () => void;

    constructor(onStreamReady: () => void) {
        super();
        this.setupMediaStream();
        this.participantSlots = new Map(Array.from({ length: PARTICIPANT_SLOTS }, (_, i) => [i, ""]));
        this.onStreamReady = onStreamReady;
    }

    private setupMediaStream(): void {
        this.rtcAudioSource = new wrtc.nonstandard.RTCAudioSource();

        const audioTrack = this.rtcAudioSource.createTrack();
        this.combinedAudioStream = new wrtc.MediaStream([audioTrack]);
    }

    public getCombinedAudioStream(): MediaStream | null {
        return this.combinedAudioStream;
    }

    public handleRemoteParticipants(participants: RemoteParticipantState[]): void {
        if (participants.length === 0) {
            this.stopAudioMixer();
            return;
        }

        if (!this.ffmpegProcess && this.rtcAudioSource) {
            this.ffmpegProcess = DEBUG_MIXER_OUTPUT
                ? spawnFFmpegProcessDebug(this.rtcAudioSource, this.onStreamReady)
                : spawnFFmpegProcess(this.rtcAudioSource, this.onStreamReady);
        }

        for (const p of participants) this.attachParticipantIfNeeded(p);

        const liveIds = new Set(participants.map((p) => p.id).filter(Boolean) as string[]);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [slot, pid] of this.participantSlots) {
            if (pid && !liveIds.has(pid)) this.detachParticipant(pid);
        }
    }

    public stopAudioMixer(): void {
        if (this.ffmpegProcess) {
            stopFFmpegProcess(this.ffmpegProcess);
            this.ffmpegProcess = null;
        }
        this.participantSlots = new Map(Array.from({ length: PARTICIPANT_SLOTS }, (_, i) => [i, ""]));
        this.activeSlots = {};
        // Recreate the media stream to avoid stale references
        this.setupMediaStream();
    }

    private slotForParticipant(participantId: string): number | null {
        const found = [...this.participantSlots.entries()].find(([, id]) => id === participantId)?.[0];
        return found === undefined ? null : found;
    }

    private acquireSlot(participantId: string): number | null {
        const existing = this.slotForParticipant(participantId);
        if (existing !== null) return existing;

        const empty = [...this.participantSlots.entries()].find(([, id]) => id === "")?.[0];
        if (empty === undefined) return null;

        this.participantSlots.set(empty, participantId);
        return empty;
    }

    private attachParticipantIfNeeded(participant: RemoteParticipantState): void {
        const { id: participantId, stream: participantStream, isAudioEnabled } = participant;
        if (!participantId) return;

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

        const { sink, writer, stop } = writeAudioDataToFFmpeg(this.ffmpegProcess!, slot, audioTrack);
        this.activeSlots[slot] = { sink, writer, stop, trackId: audioTrack.id };

        audioTrack.addEventListener?.("ended", () => this.detachParticipant(participantId));
    }

    private detachParticipant(participantId: string): void {
        const slot = this.slotForParticipant(participantId);
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
        clearSlotQueue(slot);
        this.participantSlots.set(slot, "");
    }
}
