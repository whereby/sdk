import axios from "axios";
import Credentials from "../../api/Credentials";
import DeviceService from "../../api/deviceService";
import { WherebyClient } from "../WherebyClient";

const STORAGE_KEY = "CredentialsStorage";

describe("WherebyClient", () => {
    let client: WherebyClient;
    let createDevice: jest.SpyInstance;

    beforeEach(() => {
        window.localStorage.clear();
        createDevice = jest.spyOn(DeviceService.prototype, "getCredentials");
        client = new WherebyClient();
    });

    afterEach(() => {
        client.destroy();
        createDevice.mockRestore();
    });

    describe("getDeviceCredentials", () => {
        it("returns the stored credentials without creating a device", async () => {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(new Credentials("stored-device-id", "stored-hmac", "user-id").toJson()),
            );

            const result = await client.getDeviceCredentials();

            expect(result).toEqual({ deviceId: "stored-device-id", hmac: "stored-hmac" });
            expect(createDevice).not.toHaveBeenCalled();
        });

        it("creates and stores a new device when none is stored", async () => {
            createDevice.mockResolvedValue(new Credentials("new-device-id", "new-hmac"));

            const result = await client.getDeviceCredentials();

            expect(result).toEqual({ deviceId: "new-device-id", hmac: "new-hmac" });
            expect(createDevice).toHaveBeenCalledTimes(1);
            expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toEqual({
                credentials: { uuid: "new-device-id" },
                hmac: "new-hmac",
            });
        });

        it("creates one device for concurrent calls", async () => {
            createDevice.mockResolvedValue(new Credentials("new-device-id", "new-hmac"));

            const results = await Promise.all([client.getDeviceCredentials(), client.getDeviceCredentials()]);

            expect(createDevice).toHaveBeenCalledTimes(1);
            expect(results).toEqual([
                { deviceId: "new-device-id", hmac: "new-hmac" },
                { deviceId: "new-device-id", hmac: "new-hmac" },
            ]);
        });

        it("returns null when the API returns no device", async () => {
            createDevice.mockResolvedValue(null);

            expect(await client.getDeviceCredentials()).toBeNull();
        });

        it("returns a plain object, not the Credentials class", async () => {
            createDevice.mockResolvedValue(new Credentials("new-device-id", "new-hmac"));

            const result = await client.getDeviceCredentials();

            expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        });
    });

    describe("base URLs", () => {
        let request: jest.SpyInstance;

        beforeEach(() => {
            createDevice.mockRestore();
            request = jest.spyOn(axios, "request").mockResolvedValue({
                status: 200,
                data: { credentials: { uuid: "device-id" }, hmac: "hmac" },
                headers: {},
            });
        });

        afterEach(() => {
            request.mockRestore();
        });

        it("calls the API at the given base URL", async () => {
            const customClient = new WherebyClient({ apiBaseUrl: "https://api.example.test" });

            await customClient.getDeviceCredentials();
            customClient.destroy();

            expect(request).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.example.test" }));
        });

        it("calls the production API by default", async () => {
            await client.getDeviceCredentials();

            expect(request).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.whereby.dev" }));
        });
    });
});
