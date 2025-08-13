import { WherebyClient, RoomConnectionClient, LocalMediaClient, RemoteParticipantState } from "@whereby.com/core";
import wrtc from "@roamhq/wrtc";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { AudioSink, AudioSource } from "./utils/AudioSink";
import Stream from "stream";
import { spawnFFmpegProcess, stopFFmpegProcess, writeAudioDataToFFmpeg } from "./utils/ffmpeg-helpers";

type StopActiveJobFunction = () => void;

export class Assistant {
    private client: WherebyClient;
    private roomConnection: RoomConnectionClient;
    private localMedia: LocalMediaClient;
    private mediaStream: MediaStream | null = null;
    private audioSource: wrtc.nonstandard.RTCAudioSource | null = null;
    private combinedAudioSource: AudioSource | null = null;
    private combinedAudioStream: MediaStream | null = null;
    private activeJobs = new Map<string, StopActiveJobFunction>();
    private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
    private perInput: Record<number, { sink: AudioSink; writer: Stream.Writable; stop: () => void }> = {};

    constructor(startCombinedAudioStream = false) {
        this.client = new WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();
        const outputAudioSource = new wrtc.nonstandard.RTCAudioSource();
        const outputMediaStream = new wrtc.MediaStream([outputAudioSource.createTrack()]);
        this.mediaStream = outputMediaStream;
        this.audioSource = outputAudioSource;

        if (startCombinedAudioStream) {
            this.combinedAudioSource = new AudioSource();
            this.roomConnection.subscribeToRemoteParticipants(this.handleRemoteParticipants.bind(this));
        }
    }

    public async joinRoom(roomUrl: string): Promise<void> {
        if (this.mediaStream) {
            await this.localMedia.startMedia(this.mediaStream);
        }
        this.roomConnection.initialize({
            localMediaOptions: {
                audio: false,
                video: false,
            },
            roomUrl,
            isNodeSdk: true,
        });

        this.roomConnection.joinRoom();
    }

    private handleRemoteParticipants(participants: RemoteParticipantState[]): void {
        if (this.ffmpegProcess && participants.every((p) => p.isAudioEnabled === false)) {
            stopFFmpegProcess(this.ffmpegProcess, this.combinedAudioSource!);
            Object.values(this.perInput).forEach(({ sink, writer, stop }) => {
                sink.stop();
                writer.end();
                stop();
            });
        }
        // Create a process with extra stdio pipes (fd 3..3+inputs-1)
        this.ffmpegProcess = spawnFFmpegProcess(participants.length, this.combinedAudioSource!);

        participants.forEach((participant, index) => {
            this.handleRemoteParticipantAudioStream(participant, index);
        });
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

    public getLocalMediaStream(): MediaStream | null {
        return this.mediaStream;
    }

    public getLocalAudioSource(): wrtc.nonstandard.RTCAudioSource | null {
        return this.audioSource;
    }

    public getCombinedAudioStream(): MediaStream | null {
        return this.combinedAudioStream;
    }

    public getRoomConnection(): RoomConnectionClient {
        return this.roomConnection;
    }
}
