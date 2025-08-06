import { WherebyClient, RoomConnectionClient, LocalMediaClient } from "@whereby.com/core";

export class Assistant {
    private client: WherebyClient;
    private roomConnection: RoomConnectionClient;
    private localMedia: LocalMediaClient;

    constructor() {
        this.client = new WherebyClient();
        this.roomConnection = this.client.getRoomConnection();
        this.localMedia = this.client.getLocalMedia();
    }

    public joinRoom(roomUrl: string): void {
        this.roomConnection.initialize({
            roomUrl,
        });
        this.roomConnection.joinRoom();
    }
}
