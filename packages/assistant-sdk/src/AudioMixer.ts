import type { ChildProcessWithoutNullStreams } from "child_process";
import { AudioSink, AudioSource } from "./utils/AudioSink";
import Stream from "stream";
import { RemoteParticipantState } from "@whereby.com/core";
import {
    stopFFmpegProcess,
    spawnFFmpegProcess,
    writeAudioDataToFFmpeg,
    PARTICIPANT_SLOTS,
} from "./utils/ffmpeg-helpers";

type StopActiveJobFunction = () => void;

export class AudioMixer {
    private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
    private combinedAudioStream: MediaStream | null = null;
    private combinedAudioSource: AudioSource | null = null;
    private activeJobs = new Map<string, StopActiveJobFunction>();
    // participantId -> slot index
    private participantSlots = new Map<number, string>();
    private perInput: Record<number, { sink: AudioSink; writer: Stream.Writable; stop: () => void }> = {};

    constructor() {
        this.combinedAudioSource = new AudioSource();
        this.participantSlots = new Map(Array.from({ length: PARTICIPANT_SLOTS }, (_, i) => [i + 3, ""]));
    }

    private getParticipantSlot(participantId: string): number | null {
        const existing = [...this.participantSlots.entries()].find(([_, id]) => id === participantId)?.[0] ?? -1;
        if (existing !== -1) {
            return existing;
        }
        return null;
    }

    private getAvailableSlotIndex(participantId: string): number | null {
        const existingSlot = this.getParticipantSlot(participantId);
        if (existingSlot !== null) {
            console.log(`Participant ${participantId} already has a slot:`, existingSlot);
            return existingSlot;
        }

        const emptySlot = [...this.participantSlots.entries()].find(([_, id]) => id === "")?.[0] ?? -1;

        if (emptySlot === -1) {
            console.warn("No empty slot available for participant:", participantId);
            return null;
        }

        this.participantSlots.set(emptySlot, participantId);
        console.log(`Assigned participant ${participantId} to slot ${emptySlot}`);
        return emptySlot;
    }

    private handleRemoteParticipantAudioStream(participant: RemoteParticipantState): void {
        const { id: participantId, stream: participantStream, isAudioEnabled } = participant;

        if (!participantId) {
            return;
        }

        if (!participantStream) {
            this.stop(participantId);
            return;
        }

        const audioTrack = participantStream.getTracks().find((t) => t.kind === "audio");

        if (!audioTrack || !isAudioEnabled) {
            this.stop(participantId);
            return;
        }

        const jobId = `${participantId}/${audioTrack.id}`;

        console.log(`Handling audio stream for participant: ${participantId}, jobId: ${jobId}`);
        const inputIndex = this.getAvailableSlotIndex(participantId);
        console.log(`Input index for participant ${participantId}:`, inputIndex);
        if (inputIndex === null) {
            console.warn(`No available slot for participant: ${participantId}`);
            return;
        }

        if (this.activeJobs.has(jobId)) {
            return;
        }
        const { sink, writer, stop } = writeAudioDataToFFmpeg(this.ffmpegProcess!, inputIndex, audioTrack);

        const stopActiveJob: StopActiveJobFunction = () => {
            // stop();
            this.activeJobs.delete(jobId);
        };
        this.activeJobs.set(jobId, stopActiveJob);

        this.perInput[inputIndex] = { sink, writer, stop };
    }

    private stop(participantId: string) {
        const slotIndex = this.getParticipantSlot(participantId);
        if (slotIndex !== null) {
            this.participantSlots.delete(slotIndex);
        }

        console.log(`Stopping audio for participant: ${participantId}`);
        this.activeJobs.forEach((stopActiveJob, jobId) => {
            if (jobId.startsWith(`${participantId}/`)) {
                stopActiveJob();
            }
        });
    }

    public getCombinedAudioStream(): MediaStream | null {
        return this.combinedAudioStream;
    }

    public handleRemoteParticipants(participants: RemoteParticipantState[]): void {
        if (participants.every((p) => p.isAudioEnabled === false)) {
            this.stopAudioMixer();
        }
        // Create a process with extra stdio pipes (fd 3..3+inputs-1)

        if (!this.ffmpegProcess) {
            this.ffmpegProcess = spawnFFmpegProcess(this.combinedAudioSource!);
        }

        participants.forEach((participant) => {
            this.handleRemoteParticipantAudioStream(participant);
        });
    }

    public stopAudioMixer() {
        if (this.ffmpegProcess) {
            console.log("Stopping audio mixer and FFmpeg process");
            stopFFmpegProcess(this.ffmpegProcess, this.combinedAudioSource!);
            Object.values(this.perInput).forEach(({ sink, writer, stop }) => {
                sink.stop();
                writer?.end();
                stop();
            });
        }
    }
}
