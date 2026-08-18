import { createStore, type Store as AppStore } from "../redux/store";
import { createServices } from "../services";
import { GridClient } from "./Grid";
import { LocalMediaClient } from "./LocalMedia";
import { PreCallTestClient } from "./PreCallTest";
import { RoomConnectionClient } from "./RoomConnection";

export class WherebyClient {
    protected store: AppStore;
    private services: ReturnType<typeof createServices>;
    private localMediaClient: LocalMediaClient;
    protected roomConnectionClient: RoomConnectionClient;
    private gridClient: GridClient;
    private preCallTestClient: PreCallTestClient;

    constructor() {
        this.services = createServices();
        this.store = createStore({ injectServices: this.services });

        this.localMediaClient = new LocalMediaClient(this.store);
        this.roomConnectionClient = new RoomConnectionClient(this.store);
        this.gridClient = new GridClient(this.store);
        this.preCallTestClient = new PreCallTestClient(this.store);
    }

    public getLocalMedia(): LocalMediaClient {
        return this.localMediaClient;
    }

    public getRoomConnection(): RoomConnectionClient {
        return this.roomConnectionClient;
    }

    public getGrid(): GridClient {
        return this.gridClient;
    }

    public getPreCallTest(): PreCallTestClient {
        return this.preCallTestClient;
    }

    public getStore(): AppStore {
        return this.store;
    }

    public destroy(): void {
        this.localMediaClient.destroy();
        this.roomConnectionClient.destroy();
        this.gridClient.destroy();
        this.preCallTestClient.destroy();
    }
}
