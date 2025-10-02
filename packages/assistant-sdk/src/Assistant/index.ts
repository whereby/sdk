import {
    WherebyClient,
    RoomConnectionClient,
    LocalMediaClient,
    RemoteParticipantState,
    ChatMessage,
    ConnectionStatus,
} from "@whereby.com/core";
import wrtc from "@roamhq/wrtc";
import { AudioMixer } from "../AudioMixer";
import EventEmitter from "events";
import {
    ASSISTANT_JOINED_ROOM,
    ASSISTANT_LEFT_ROOM,
    AUDIO_STREAM_READY,
    PARTICIPANT_VIDEO_TRACK_ADDED,
    PARTICIPANT_VIDEO_TRACK_REMOVED,
    PARTICIPANT_AUDIO_TRACK_ADDED,
    PARTICIPANT_AUDIO_TRACK_REMOVED,
    AssistantEvents,
} from "./types";

export type AssistantOptions = {
    assistantKey: string;
    startCombinedAudioStream?: boolean;
    startLocalMedia?: boolean;
};

export class Assistant extends EventEmitter<AssistantEvents> {
    private assistantKey: string;
    private client: WherebyClient;
    private roomConnection: RoomConnectionClient;
    private localMedia: LocalMediaClient;
    private mediaStream: MediaStream | null = null;
    private audioSource: wrtc.nonstandard.RTCAudioSource | null = null;
    private combinedStream: MediaStream | null = null;
    private remoteMediaTracks: Record<
        string,
        { participantId: string; stream: wrtc.MediaStream; track: wrtc.MediaStreamTrack }
    > = {};
    private roomUrl: string | null = null;
    private stateSubscriptions: (() => void)[] = [];

    constructor({ assistantKey, startCombinedAudioStream = false, startLocalMedia = false }: AssistantOptions) {
        super();
        this.assistantKey = assistantKey;
        this.client = new WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();

        if (startLocalMedia) {
            const outputAudioSource = new wrtc.nonstandard.RTCAudioSource();
            const outputMediaStream = new wrtc.MediaStream([outputAudioSource.createTrack()]);
            this.mediaStream = outputMediaStream;
            this.audioSource = outputAudioSource;
        }

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

            this.stateSubscriptions.push(
                this.roomConnection.subscribeToRemoteParticipants(audioMixer.handleRemoteParticipants.bind(audioMixer)),
            );
        }

        this.stateSubscriptions.push(
            this.roomConnection.subscribeToConnectionStatus(this.handleConnectionStatusChange),
        );

        this.stateSubscriptions.push(
            this.roomConnection.subscribeToRemoteParticipants(this.handleRemoteParticipantsTracksChange),
        );
    }

    private handleConnectionStatusChange = (status: ConnectionStatus) => {
        if (status === "connected") {
            this.emit(ASSISTANT_JOINED_ROOM, { roomUrl: this.roomUrl || "" });
        }
        if (["left", "kicked"].includes(status)) {
            this.stateSubscriptions.forEach((unsubscribe) => unsubscribe());

            this.emit(ASSISTANT_LEFT_ROOM, { roomUrl: this.roomUrl || "" });
        }
    };

    private handleRemoteParticipantsTracksChange = (remoteParticipants: RemoteParticipantState[]) => {
        const currentRemoteMediaTracks = remoteParticipants.flatMap(({ id: participantId, stream }) => {
            if (!stream) {
                return [];
            }

            const tracks = stream.getTracks();

            tracks.forEach((track) => {
                if (!this.remoteMediaTracks[track.id]) {
                    const eventName =
                        track.kind === "video" ? PARTICIPANT_VIDEO_TRACK_ADDED : PARTICIPANT_AUDIO_TRACK_ADDED;

                    this.emit(eventName, {
                        participantId,
                        stream,
                        track,
                    });

                    this.remoteMediaTracks[track.id] = {
                        participantId,
                        stream,
                        track,
                    };
                }
            });

            return tracks;
        });

        Object.values(this.remoteMediaTracks).forEach(({ participantId, stream, track }) => {
            if (!currentRemoteMediaTracks.includes(track)) {
                const eventName =
                    track.kind === "video" ? PARTICIPANT_VIDEO_TRACK_REMOVED : PARTICIPANT_AUDIO_TRACK_REMOVED;

                this.emit(eventName, {
                    participantId,
                    stream,
                    track,
                });

                delete this.remoteMediaTracks[track.id];
            }
        });
    };

    public async joinRoom(roomUrl: string) {
        if (this.mediaStream) {
            await this.localMedia.startMedia(this.mediaStream);
        }
        this.roomUrl = roomUrl;
        this.roomConnection.initialize({
            localMediaOptions: {
                audio: false,
                video: false,
            },
            roomUrl,
            isNodeSdk: true,
            assistantKey: this.assistantKey,
        });
        return this.roomConnection.joinRoom();
    }

    public startLocalMedia(): void {
        if (!this.mediaStream) {
            const outputAudioSource = new wrtc.nonstandard.RTCAudioSource();
            const outputMediaStream = new wrtc.MediaStream([outputAudioSource.createTrack()]);
            this.mediaStream = outputMediaStream;
            this.audioSource = outputAudioSource;
        }
        this.localMedia.startMedia(this.mediaStream);
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

    public subscribeToChatMessages(callback: (messages: ChatMessage[]) => void): () => void {
        return this.roomConnection.subscribeToChatMessages(callback);
    }
}
