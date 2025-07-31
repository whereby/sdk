import { createStore, type Store as AppStore } from "../redux/store";
import { createServices } from "../services";
import { GridClient } from "./Grid";
import { LocalMediaClient } from "./LocalMedia";
import { RoomConnectionClient } from "./RoomConnection";

export class WherebyClient {
    private store: AppStore;
    private services: ReturnType<typeof createServices>;
    private localMediaClient: LocalMediaClient;
    private roomConnectionClient: RoomConnectionClient;
    private gridClient: GridClient;

    constructor() {
        this.services = createServices();
        this.store = createStore({ injectServices: this.services });

        this.localMediaClient = new LocalMediaClient(this.store);
        this.roomConnectionClient = new RoomConnectionClient(this.store);
        this.gridClient = new GridClient(this.store);
    }

    public getLocalMediaClient(): LocalMediaClient {
        return this.localMediaClient;
    }

    public getRoomConnectionClient(): RoomConnectionClient {
        return this.roomConnectionClient;
    }

    public getGridClient(): GridClient {
        return this.gridClient;
    }

    public getStore(): AppStore {
        return this.store;
    }

    public destroy(): void {
        this.localMediaClient.destroy();
        this.roomConnectionClient.destroy();
        this.gridClient.destroy();
    }
}
