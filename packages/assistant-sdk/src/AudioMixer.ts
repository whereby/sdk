import type { ChildProcessWithoutNullStreams } from "child_process";
import { AudioSink, AudioSource } from "./utils/AudioSink";
import Stream from "stream";
import { RemoteParticipantState } from "@whereby.com/core";
import { stopFFmpegProcess, spawnFFmpegProcess, writeAudioDataToFFmpeg } from "./utils/ffmpeg-helpers";
type StopActiveJobFunction = () => void;

export class AudioMixer {
    private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
    private combinedAudioStream: MediaStream | null = null;
    private combinedAudioSource: AudioSource | null = null;
    private activeJobs = new Map<string, StopActiveJobFunction>();
    private perInput: Record<number, { sink: AudioSink; writer: Stream.Writable; stop: () => void }> = {};

    constructor() {
        this.combinedAudioSource = new AudioSource();
    }

    private handleRemoteParticipantAudioStream(participant: RemoteParticipantState, inputIndex: number): void {
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
            this.ffmpegProcess = spawnFFmpegProcess(participants.length, this.combinedAudioSource!);
        }

        participants.forEach((participant, index) => {
            this.handleRemoteParticipantAudioStream(participant, index);
        });
    }

    public stopAudioMixer() {
        if (this.ffmpegProcess) {
            stopFFmpegProcess(this.ffmpegProcess, this.combinedAudioSource!);
            Object.values(this.perInput).forEach(({ sink, writer, stop }) => {
                sink.stop();
                writer?.end();
                stop();
            });
        }
    }
}
