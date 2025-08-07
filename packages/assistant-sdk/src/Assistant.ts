import { WherebyClient, RoomConnectionClient, LocalMediaClient } from "@whereby.com/core";
import wrtc from "@roamhq/wrtc";

export class Assistant {
    private client: WherebyClient;
    private roomConnection: RoomConnectionClient;
    private localMedia: LocalMediaClient;
    private mediaStream: MediaStream | null = null;

    constructor() {
        this.client = new WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();
    }

    public joinRoom(roomUrl: string, withStream?: boolean): void {
        this.roomConnection.initialize({
            roomUrl,
        });
        this.roomConnection.joinRoom();

        if (withStream) {
            const outputAudioSource = new wrtc.nonstandard.RTCAudioSource();
            const outputMediaStream = new wrtc.MediaStream([outputAudioSource.createTrack()]);
            this.localMedia.startMedia(outputMediaStream);
            this.mediaStream = outputMediaStream;
        }
    }

    public getLocalMediaStream(): MediaStream | null {
        return this.mediaStream;
    }
}
