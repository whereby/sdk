import { createStore, type Store as AppStore } from "../redux/store";
import { createServices } from "../services";
import { GridClient } from "./Grid";
import { LocalMediaClient } from "./LocalMedia";
import { RoomConnectionClient } from "./RoomConnection";

/**
 * The credentials of the device the SDK uses to call the Whereby API.
 */
export interface DeviceCredentials {
    deviceId: string;
    hmac: string;
}

export class WherebyClient {
    protected store: AppStore;
    private services: ReturnType<typeof createServices>;
    private localMediaClient: LocalMediaClient;
    protected roomConnectionClient: RoomConnectionClient;
    private gridClient: GridClient;

    constructor() {
        this.services = createServices();
        this.store = createStore({ injectServices: this.services });

        this.localMediaClient = new LocalMediaClient(this.store);
        this.roomConnectionClient = new RoomConnectionClient(this.store);
        this.gridClient = new GridClient(this.store);
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

    /**
     * Gets the credentials of the device this client uses for the Whereby API, for apps that call the Whereby API
     * as the same device as the SDK. Build the header as `Authorization: Basic base64(deviceId:hmac)`.
     *
     * Returns the stored credentials if there are any. Otherwise it registers a new device, as joining a room does,
     * and stores its credentials. Concurrent calls share one request.
     *
     * @returns The device credentials, or null if the API returned none.
     */
    public async getDeviceCredentials(): Promise<DeviceCredentials | null> {
        const credentials = await this.services.credentialsService.getCredentials();

        if (!credentials) {
            return null;
        }

        return { deviceId: credentials.credentials.uuid, hmac: credentials.hmac };
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
