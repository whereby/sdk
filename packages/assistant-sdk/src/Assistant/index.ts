import { WherebyClient, RoomConnectionClient, LocalMediaClient, RemoteParticipantState } from "@whereby.com/core";
import wrtc from "@roamhq/wrtc";
import { AudioMixer } from "../AudioMixer";
import EventEmitter from "events";
import { AUDIO_STREAM_READY, AssistantEvents } from "./types";

export type AssistantOptions = {
    assistantKey?: string;
    startCombinedAudioStream: boolean;
};

export class Assistant extends EventEmitter<AssistantEvents> {
    private assistantKey?: string;
    private client: WherebyClient;
    private roomConnection: RoomConnectionClient;
    private localMedia: LocalMediaClient;
    private mediaStream: MediaStream | null = null;
    private audioSource: wrtc.nonstandard.RTCAudioSource | null = null;
    private combinedStream: MediaStream | null = null;

    constructor({ assistantKey, startCombinedAudioStream }: AssistantOptions = { startCombinedAudioStream: false }) {
        super();
        this.assistantKey = assistantKey;
        this.client = new WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();
        const outputAudioSource = new wrtc.nonstandard.RTCAudioSource();
        const outputMediaStream = new wrtc.MediaStream([outputAudioSource.createTrack()]);
        this.mediaStream = outputMediaStream;
        this.audioSource = outputAudioSource;

        if (startCombinedAudioStream) {
            const handleStreamReady = () => {
                if (!this.combinedStream) {
                    console.warn("Combined stream is not available");
                    return;
                }

                this.emit(AUDIO_STREAM_READY, {
                    stream: this.combinedStream!,
                    track: this.combinedStream!.getAudioTracks()[0],
                });
            };
            const audioMixer = new AudioMixer(handleStreamReady);
            this.combinedStream = audioMixer.getCombinedAudioStream();
            this.roomConnection.subscribeToRemoteParticipants(audioMixer.handleRemoteParticipants.bind(audioMixer));
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
            roomKey: this.assistantKey,
        });
        this.roomConnection.joinRoom();
    }

    public getLocalMediaStream(): MediaStream | null {
        return this.mediaStream;
    }

    public getLocalAudioSource(): wrtc.nonstandard.RTCAudioSource | null {
        return this.audioSource;
    }

    public getRoomConnection(): RoomConnectionClient {
        return this.roomConnection;
    }

    public getCombinedAudioStream(): MediaStream | null {
        return this.combinedStream;
    }

    public getRemoteParticipants(): RemoteParticipantState[] {
        return this.roomConnection.getState().remoteParticipants;
    }

    public startCloudRecording(): void {
        this.roomConnection.startCloudRecording();
    }

    public stopCloudRecording(): void {
        this.roomConnection.stopCloudRecording();
    }

    public sendChatMessage(message: string): void {
        this.roomConnection.sendChatMessage(message);
    }

    public spotlightParticipant(participantId: string): void {
        this.roomConnection.spotlightParticipant(participantId);
    }

    public removeSpotlight(participantId: string): void {
        this.roomConnection.removeSpotlight(participantId);
    }

    public requestAudioEnable(participantId: string, enable: boolean): void {
        if (enable) {
            this.roomConnection.askToSpeak(participantId);
        } else {
            this.roomConnection.muteParticipants([participantId]);
        }
    }

    public requestVideoEnable(participantId: string, enable: boolean): void {
        if (enable) {
            this.roomConnection.askToTurnOnCamera(participantId);
        } else {
            this.roomConnection.turnOffParticipantCameras([participantId]);
        }
    }

    public acceptWaitingParticipant(participantId: string): void {
        this.roomConnection.acceptWaitingParticipant(participantId);
    }

    public rejectWaitingParticipant(participantId: string): void {
        this.roomConnection.rejectWaitingParticipant(participantId);
    }

    public subscribeToRemoteParticipants(callback: (participants: RemoteParticipantState[]) => void): () => void {
        return this.roomConnection.subscribeToRemoteParticipants(callback);
    }
}
