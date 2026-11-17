import { GridClient } from "../";
import { CLIENT_VIEW_CHANGED } from "../events";
import { createStore, mockSignalEmit } from "../../../redux/tests/store.setup";
import { randomLocalParticipant, randomRemoteParticipant } from "../../../__mocks__/appMocks";
import { CAMERA_STREAM_ID, type RoleName } from "@whereby.com/media";

function setup({ roleName = "visitor" }: { roleName?: RoleName } = {}) {
    const store = createStore({
        initialState: {
            authorization: { roomKey: null, roleName },
            localParticipant: randomLocalParticipant({ id: "local" }),
            remoteParticipants: {
                remoteParticipants: ["r1", "r2"].map((id) => randomRemoteParticipant({ id })),
            },
            spotlights: {
                sorted: [
                    { clientId: "r1", streamId: CAMERA_STREAM_ID },
                    { clientId: "r2", streamId: CAMERA_STREAM_ID },
                ],
            },
        },
        withSignalConnection: true,
    });
    const client = new GridClient(store);
    const order = () => client.getState().allClientViews.map((c) => c.id);

    return { client, order };
}

describe("GridClient", () => {
    describe("reorderClientViews", () => {
        it("swaps two client views and notifies subscribers", () => {
            const { client, order } = setup();
            const subscriber = jest.fn();
            const listener = jest.fn();
            client.subscribeClientViews(subscriber);
            client.on(CLIENT_VIEW_CHANGED, listener);

            client.reorderClientViews({ id: "local", targetId: "r2" });

            expect(order()).toEqual(["r2", "r1", "local"]);
            expect(subscriber).toHaveBeenCalledWith(client.getState().allClientViews);
            expect(listener).toHaveBeenCalledWith(client.getState().allClientViews);
        });

        it("throws on ids that aren't strings", () => {
            const { client } = setup();

            expect(() => client.reorderClientViews({ id: "local" } as { id: string; targetId: string })).toThrow(
                TypeError,
            );
        });
    });

    describe("setClientViewOrder", () => {
        it("sets the order", () => {
            const { client, order } = setup();

            client.setClientViewOrder(["r2"]);

            expect(order()).toEqual(["r2", "local", "r1"]);
        });

        it("throws on anything but an array of ids", () => {
            const { client } = setup();

            expect(() => client.setClientViewOrder("r2" as unknown as string[])).toThrow(TypeError);
            expect(() => client.setClientViewOrder([1] as unknown as string[])).toThrow(TypeError);
        });
    });

    describe("swapSpotlightOrder", () => {
        it("sends swap_spotlight_order", () => {
            const { client } = setup({ roleName: "host" });

            client.swapSpotlightOrder({ id: "r1", targetId: "r2" });

            expect(mockSignalEmit).toHaveBeenCalledWith("swap_spotlight_order", {
                source: { clientId: "r1", streamId: CAMERA_STREAM_ID },
                target: { clientId: "r2", streamId: CAMERA_STREAM_ID },
            });
        });
    });

    describe("canSpotlight", () => {
        it("is true for a host", () => {
            expect(setup({ roleName: "host" }).client.getState().canSpotlight).toBe(true);
        });

        it("is false for a visitor", () => {
            expect(setup({ roleName: "visitor" }).client.getState().canSpotlight).toBe(false);
        });
    });
});
