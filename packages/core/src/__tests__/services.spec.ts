import axios from "axios";
import Credentials from "../api/Credentials";
import { createServices } from "../services";

const STORAGE_KEY = "CredentialsStorage";

describe("createServices", () => {
    let request: jest.SpyInstance;

    beforeEach(() => {
        window.localStorage.clear();
        request = jest.spyOn(axios, "request").mockResolvedValue({
            status: 200,
            data: { credentials: { uuid: "device-id" }, hmac: "hmac" },
            headers: {},
        });
    });

    afterEach(() => {
        request.mockRestore();
    });

    function requestedBaseUrls() {
        return request.mock.calls.map(([options]) => options.baseURL);
    }

    describe("with base URLs", () => {
        const apiBaseUrl = "https://api.example.test";
        const signalBaseUrl = "wss://signal.example.test";

        it("registers the device with the given API", async () => {
            const services = createServices({ apiBaseUrl, signalBaseUrl });

            await services.credentialsService.getCredentials().catch(() => null);

            expect(request).toHaveBeenCalled();
            expect(requestedBaseUrls()).toEqual(request.mock.calls.map(() => apiBaseUrl));
        });

        it("fetches the organization and room integrations from the given API", async () => {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(new Credentials("device-id", "hmac", "user-id").toJson()),
            );
            const services = createServices({ apiBaseUrl, signalBaseUrl });

            await services.fetchOrganizationFromRoomUrl("https://acme.whereby.com/room").catch(() => null);
            await services.roomIntegrationService
                .findRoomIntegrations({ organizationId: "org-id", roomName: "/room" })
                .catch(() => null);

            expect(request).toHaveBeenCalledTimes(2);
            expect(requestedBaseUrls()).toEqual([apiBaseUrl, apiBaseUrl]);
        });

        it("uses the given signal URL", () => {
            expect(createServices({ apiBaseUrl, signalBaseUrl }).signalBaseUrl).toBe(signalBaseUrl);
        });
    });

    describe("without base URLs", () => {
        it("uses the production API", async () => {
            const services = createServices();

            await services.credentialsService.getCredentials().catch(() => null);

            expect(request).toHaveBeenCalled();
            expect(requestedBaseUrls()).toEqual(request.mock.calls.map(() => "https://api.whereby.dev"));
        });

        it("uses the production signal server", () => {
            expect(createServices().signalBaseUrl).toBe("wss://signal.appearin.net");
        });
    });
});
