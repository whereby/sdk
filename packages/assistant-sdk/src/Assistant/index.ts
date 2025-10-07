import {
    WherebyClient,
    RoomConnectionClient,
    LocalMediaClient,
    RemoteParticipantState,
    ConnectionStatus,
} from "@whereby.com/core";
import wrtc from "@roamhq/wrtc";
import { AudioMixer } from "../AudioMixer";
import EventEmitter from "events";
import {
    ASSISTANT_JOINED_ROOM,
    ASSISTANT_LEFT_ROOM,
    PARTICIPANT_VIDEO_TRACK_ADDED,
    PARTICIPANT_VIDEO_TRACK_REMOVED,
    PARTICIPANT_AUDIO_TRACK_ADDED,
    PARTICIPANT_AUDIO_TRACK_REMOVED,
    AssistantEvents,
} from "./types";
import { AudioSource, AudioSink } from "../utils/AudioEndpoints";
import { VideoSource, VideoSink } from "../utils/VideoEndpoints";

export type AssistantOptions = {
    assistantKey: string;
};

export class Assistant extends EventEmitter<AssistantEvents> {
    private assistantKey: string;
    private client: WherebyClient;
    private roomConnection: RoomConnectionClient;
    private localAudioSource: AudioSource | null = null;
    private localVideoSource: VideoSource | null = null;
    private localMedia: LocalMediaClient;
    private combinedAudioSink: AudioSink | null = null;
    private remoteMediaTracks: Record<string, { participantId: string; track: wrtc.MediaStreamTrack }> = {};
    private roomUrl: string | null = null;
    private stateSubscriptions: (() => void)[] = [];

    constructor({ assistantKey }: AssistantOptions) {
        super();
        this.assistantKey = assistantKey;
        this.client = new WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();

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
                    if (track.kind === "video") {
                        this.emit(PARTICIPANT_VIDEO_TRACK_ADDED, {
                            participantId,
                            trackId: track.id,
                            data: new VideoSink(track),
                        });
                    } else {
                        this.emit(PARTICIPANT_AUDIO_TRACK_ADDED, {
                            participantId,
                            trackId: track.id,
                            data: new AudioSink(track),
                        });
                    }

                    this.remoteMediaTracks[track.id] = {
                        participantId,
                        track,
                    };
                }
            });

            return tracks;
        });

        Object.values(this.remoteMediaTracks).forEach(({ participantId, track }) => {
            if (!currentRemoteMediaTracks.includes(track)) {
                const eventName =
                    track.kind === "video" ? PARTICIPANT_VIDEO_TRACK_REMOVED : PARTICIPANT_AUDIO_TRACK_REMOVED;

                this.emit(eventName, {
                    participantId,
                    trackId: track.id,
                });

                delete this.remoteMediaTracks[track.id];
            }
        });
    };

    public joinRoom(roomUrl: string) {
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

    public getRoomConnection(): RoomConnectionClient {
        return this.roomConnection;
    }

    public startLocalMedia(): void {
        if (Boolean(this.localAudioSource) || Boolean(this.localVideoSource)) {
            return;
        }

        this.localAudioSource = new AudioSource();
        this.localVideoSource = new VideoSource();

        const outputMediaStream = new wrtc.MediaStream([
            this.localAudioSource.createTrack(),
            this.localVideoSource.createTrack(),
        ]);

        this.localMedia.startMedia(outputMediaStream);
        this.localMedia.toggleMicrophone(true);
    }

    public stopLocalMedia(): void {
        this.localMedia.stopMedia();

        this.localAudioSource = null;
        this.localVideoSource = null;
    }

    public getLocalAudioSource(): AudioSource | null {
        return this.localAudioSource;
    }

    public getLocalVideoSource(): VideoSource | null {
        return this.localVideoSource;
    }

    public getLocalMedia(): LocalMediaClient {
        return this.localMedia;
    }

    public getCombinedAudioSink(): AudioSink | null {
        if (this.combinedAudioSink) {
            return this.combinedAudioSink;
        }

        const audioMixer = new AudioMixer();
        const stream = audioMixer.getCombinedAudioStream();

        const audioTracks = stream?.getAudioTracks();

        if (audioTracks?.length) {
            this.combinedAudioSink = new AudioSink(audioTracks[0]);

            this.stateSubscriptions.push(
                this.roomConnection.subscribeToRemoteParticipants(audioMixer.handleRemoteParticipants.bind(audioMixer)),
            );

            return this.combinedAudioSink;
        }

        return null;
    }
}
