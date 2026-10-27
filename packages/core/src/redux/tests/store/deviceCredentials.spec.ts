import { diff } from "deep-object-diff";
import { doGetDeviceCredentials } from "../../slices/deviceCredentials";
import { doOrganizationFetch } from "../../slices/organization";
import { createStore, mockServices } from "../store.setup";

describe("actions", () => {
    it("doGetDeviceCredentials", async () => {
        mockServices.credentialsService.getCredentials.mockResolvedValueOnce({
            credentials: { uuid: "uuid" },
            hmac: "hmac",
            userId: "userId",
        });
        const store = createStore();

        const before = store.getState().deviceCredentials;

        await store.dispatch(doGetDeviceCredentials());

        const after = store.getState().deviceCredentials;

        expect(mockServices.credentialsService.getCredentials).toHaveBeenCalled();
        expect(store.getState().deviceCredentials.data).toEqual({
            credentials: { uuid: "uuid" },
            hmac: "hmac",
            userId: "userId",
        });
        expect(diff(before, after)).toEqual({
            data: {
                credentials: { uuid: "uuid" },
                hmac: "hmac",
                userId: "userId",
            },
        });
    });

    describe("when the fetch fails", () => {
        beforeEach(() => {
            // store.setup makes console.error throw, which would reject the thunk on its own and hide
            // whether the thunk itself reports the failure.
            console.error = jest.fn();
        });

        it("rejects and stops fetching", async () => {
            mockServices.credentialsService.getCredentials.mockRejectedValueOnce(new Error("Network error"));
            const store = createStore();

            const result = await store.dispatch(doGetDeviceCredentials());

            expect(result.type).toEqual(doGetDeviceCredentials.rejected.type);
            expect(store.getState().deviceCredentials).toEqual({
                data: null,
                isFetching: false,
                error: true,
            });
        });

        it("reports the failure as a connection error", async () => {
            mockServices.credentialsService.getCredentials.mockRejectedValueOnce(new Error("Network error"));
            const store = createStore();

            await store.dispatch(doGetDeviceCredentials());

            expect(store.getState().roomConnection).toEqual(
                expect.objectContaining({
                    status: "disconnected",
                    error: "device_credentials_fetch_failed",
                }),
            );
        });

        it("isn't reported as an organization failure when the organization fetch fails because of it", async () => {
            mockServices.credentialsService.getCredentials.mockRejectedValueOnce(new Error("Network error"));
            mockServices.fetchOrganizationFromRoomUrl.mockRejectedValueOnce(new Error("Network error"));
            const store = createStore();

            await store.dispatch(doGetDeviceCredentials());
            await store.dispatch(doOrganizationFetch());

            expect(store.getState().roomConnection.error).toEqual("device_credentials_fetch_failed");
        });
    });
});
