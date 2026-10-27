import { EventEmitter } from "events";

import DeviceService from "../deviceService/index";
import AbstractStore from "../modules/AbstractStore";
import ChromeStorageStore from "../modules/ChromeStorageStore";
import LocalStorageStore from "../modules/LocalStorageStore";
import ApiClient from "../ApiClient";
import localStorage from "../localStorageWrapper";
import Credentials from "../Credentials";

/**
 * Events triggered by this service
 */
export const events = {
    CREDENTIALS_SAVED: "credentials_saved",
};

const CREDENTIALS_FETCH_ATTEMPTS = 3;
const CREDENTIALS_RETRY_BASE_DELAY = 1000;

export default class CredentialsService extends EventEmitter {
    _deviceService: DeviceService;
    _credentialsStore: AbstractStore;
    credentialsPromise?: Promise<Credentials | null>;

    /**
     * Service to manage Whereby's Rest API credentials.
     *
     * @param {ObjectStore} credentialsStore - Store to manage the credentials.
     */
    constructor({
        deviceService,
        credentialsStore,
    }: {
        deviceService: DeviceService;
        credentialsStore: AbstractStore;
    }) {
        super();
        this._deviceService = deviceService;
        this._credentialsStore = credentialsStore;
    }

    static create({
        baseUrl,
        storeName = "CredentialsStorage",
        storeType = "localStorage",
    }: {
        baseUrl: string;
        storeName?: string;
        storeType?: "localStorage" | "chromeStorage";
    }): CredentialsService {
        const deviceService = new DeviceService({
            apiClient: new ApiClient({ baseUrl }),
        });

        let credentialsStore = null;

        if (storeType === "localStorage") {
            credentialsStore = new LocalStorageStore(storeName, localStorage);
        } else if (storeType === "chromeStorage") {
            credentialsStore = new ChromeStorageStore(storeName, window["chrome"].storage.local);
        } else {
            throw new Error(`Unknown store type: ${storeType}`);
        }

        return new CredentialsService({
            deviceService,
            credentialsStore,
        });
    }
    /**
     * Contacts the REST API to get new credentials. DO NOT USE directly, call getCredentials() instead.
     * Retries with backoff and rejects after CREDENTIALS_FETCH_ATTEMPTS failed attempts.
     *
     * @see getCredentials
     * @returns {Promise.<Credentials>} - Promise that resolves with the credentials.
     */
    async _fetchNewCredentialsFromApi(): Promise<Credentials | null> {
        for (let attempt = 1; ; attempt++) {
            try {
                const credentials = await this._deviceService.getCredentials();

                if (!credentials) {
                    throw new Error("No device credentials returned");
                }

                // Blocked storage must not fail the fetch. The store warns about it.
                await this._credentialsStore.save(credentials.toJson()).catch(() => undefined);

                return credentials;
            } catch (error) {
                if (attempt >= CREDENTIALS_FETCH_ATTEMPTS) {
                    throw error;
                }

                await new Promise((resolve) => setTimeout(resolve, CREDENTIALS_RETRY_BASE_DELAY * 2 ** (attempt - 1)));
            }
        }
    }

    /**
     * Returns the current credentials without triggering an API request to get new ones.
     * If no credentials are currently available it will return null.
     *
     * @returns {?Credentials} - The credentials currently in use, null otherwise.
     */
    getCurrentCredentials(): Promise<Credentials | null> {
        return this._credentialsStore.loadOrDefault(null).then((json) => (json ? Credentials.fromJson(json) : null));
    }

    /**
     * Returns a promise that will contain the credentials for this client.
     * If no credentials are available in local storage, new ones will be fetched from the server.
     *
     * @returns {Promise.<Credentials>} - Promise that resolves with the credentials.
     */
    getCredentials(): Promise<Credentials | null> {
        if (!this.credentialsPromise) {
            const credentialsPromise = this.getCurrentCredentials().then((storedCredentials) => {
                if (storedCredentials) {
                    return storedCredentials;
                }

                return this._fetchNewCredentialsFromApi();
            });

            // Forget a failed fetch, so the next call tries again.
            credentialsPromise.catch(() => {
                if (this.credentialsPromise === credentialsPromise) {
                    this.credentialsPromise = undefined;
                }
            });

            this.credentialsPromise = credentialsPromise;
        }

        return this.credentialsPromise;
    }

    /**
     * Saves new credentials which replace the existing ones and abort any pending request to get new ones.
     *
     * @param {Credentials} credentials - New credentials to store.
     */
    saveCredentials(credentials: Credentials): Promise<Credentials> {
        this.credentialsPromise = undefined;
        return this._credentialsStore.save(credentials.toJson()).then(() => {
            this.emit(events.CREDENTIALS_SAVED, credentials);
            return credentials;
        });
    }

    /**
     * It will set the userId for the current credentials.
     *
     * @param userId - The user id to set.
     */
    setUserId(userId: string | null): Promise<void> {
        // Used to ensure that the userId is changed if localStorage has been modified by another tab
        return this.getCurrentCredentials()
            .then((storedCredentials) => {
                if (!storedCredentials) {
                    console.error("Illegal state: no credentials to set user id for.");
                }

                const userIdChangedFromLocalStorage = storedCredentials === null || storedCredentials.userId !== userId;
                if (!userIdChangedFromLocalStorage) {
                    return undefined;
                }

                return this._credentialsStore.save(Object.assign({}, storedCredentials?.toJson(), { userId }));
            })
            .then(() => undefined);
    }
}
