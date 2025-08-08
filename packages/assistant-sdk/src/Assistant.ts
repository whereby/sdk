import { WherebyClient, RoomConnectionClient, LocalMediaClient } from "@whereby.com/core";
import wrtc from "@roamhq/wrtc";

export class Assistant {
    private client: WherebyClient;
    private roomConnection: RoomConnectionClient;
    private localMedia: LocalMediaClient;
    private mediaStream: MediaStream | null = null;
    private audioSource: wrtc.nonstandard.RTCAudioSource | null = null;

    constructor() {
        this.client = new WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();
    }

    public async joinRoom(roomUrl: string, withStream?: boolean): Promise<void> {
        if (withStream) {
            const outputAudioSource = new wrtc.nonstandard.RTCAudioSource();
            const outputMediaStream = new wrtc.MediaStream([outputAudioSource.createTrack()]);
            await this.localMedia.startMedia(outputMediaStream);
            this.mediaStream = outputMediaStream;
            this.audioSource = outputAudioSource;
        }
        this.roomConnection.initialize({
            roomUrl,
            isNodeSdk: true,
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
}
