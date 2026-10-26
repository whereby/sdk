import { diff } from "deep-object-diff";
import { doOrganizationFetch } from "../../slices/organization";
import { createStore, mockServices } from "../store.setup";

describe("actions", () => {
    it("doOrganizationFetch", async () => {
        mockServices.fetchOrganizationFromRoomUrl.mockResolvedValueOnce({
            organizationId: "orgId",
            organizationName: "orgName",
        });
        const store = createStore();

        const before = store.getState().organization;

        await store.dispatch(doOrganizationFetch());

        const after = store.getState().organization;

        expect(mockServices.fetchOrganizationFromRoomUrl).toHaveBeenCalled();
        expect(diff(before, after)).toEqual({
            data: {
                organizationId: "orgId",
                organizationName: "orgName",
            },
        });
    });

    describe("when the fetch fails", () => {
        beforeEach(() => {
            // store.setup makes console.error throw, which would reject the thunk on its own and hide
            // whether the thunk itself reports the failure.
            console.error = jest.fn();
        });

        it.each`
            failure                       | mockFetch
            ${"the request rejects"}      | ${() => mockServices.fetchOrganizationFromRoomUrl.mockRejectedValueOnce(new Error("Network error"))}
            ${"no organization is found"} | ${() => mockServices.fetchOrganizationFromRoomUrl.mockResolvedValueOnce(undefined)}
        `("rejects and stops fetching when $failure", async ({ mockFetch }) => {
            mockFetch();
            const store = createStore();

            const result = await store.dispatch(doOrganizationFetch());

            expect(result.type).toEqual(doOrganizationFetch.rejected.type);
            expect(store.getState().organization).toEqual({
                data: null,
                isFetching: false,
                error: true,
            });
        });

        it("reports the failure as a connection error", async () => {
            mockServices.fetchOrganizationFromRoomUrl.mockRejectedValueOnce(new Error("Network error"));
            const store = createStore();

            await store.dispatch(doOrganizationFetch());

            expect(store.getState().roomConnection).toEqual(
                expect.objectContaining({
                    status: "disconnected",
                    error: "organization_fetch_failed",
                }),
            );
        });
    });
});
