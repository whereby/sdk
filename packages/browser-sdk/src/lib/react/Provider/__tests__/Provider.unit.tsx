import * as React from "react";
import { render, renderHook } from "@testing-library/react";

import { WherebyClient } from "@whereby.com/core";
import { Provider, WherebyContext } from "..";
import { useRoomConnection } from "../../useRoomConnection";

function renderProvider(client?: WherebyClient) {
    const seen: (WherebyClient | null)[] = [];

    function Consumer() {
        seen.push(React.useContext(WherebyContext));
        return null;
    }

    const result = render(
        <Provider client={client}>
            <Consumer />
        </Provider>,
    );

    return { ...result, seen, Consumer };
}

describe("WherebyProvider", () => {
    let destroySpy: jest.SpyInstance;

    beforeEach(() => {
        destroySpy = jest.spyOn(WherebyClient.prototype, "destroy");
    });

    afterEach(() => {
        destroySpy.mockRestore();
    });

    describe("without a client prop", () => {
        it("creates its own client and keeps it across rerenders", () => {
            const { seen, rerender, Consumer } = renderProvider();

            rerender(
                <Provider>
                    <Consumer />
                </Provider>,
            );

            expect(seen[0]).toBeInstanceOf(WherebyClient);
            expect(seen).toHaveLength(2);
            expect(seen[1]).toBe(seen[0]);
        });

        it("destroys its client on unmount", () => {
            const { seen, unmount } = renderProvider();

            expect(destroySpy).not.toHaveBeenCalled();
            unmount();

            expect(destroySpy).toHaveBeenCalledTimes(1);
            expect(destroySpy.mock.contexts[0]).toBe(seen[0]);
        });
    });

    describe("with a client prop", () => {
        it("gives the hooks the client it was passed", () => {
            const client = new WherebyClient();

            const { seen } = renderProvider(client);

            expect(seen).toEqual([client]);
        });

        it("does not destroy the client on unmount", () => {
            const client = new WherebyClient();

            const { unmount } = renderProvider(client);
            unmount();

            expect(destroySpy).not.toHaveBeenCalled();
        });

        it("uses the same client across a remount and never destroys it", () => {
            const client = new WherebyClient();

            const first = renderProvider(client);
            first.unmount();
            const second = renderProvider(client);
            second.unmount();

            expect([...first.seen, ...second.seen]).toEqual([client, client]);
            expect(destroySpy).not.toHaveBeenCalled();
        });

        it("does not create or destroy a client under StrictMode's double mount", () => {
            const client = new WherebyClient();
            const seen: (WherebyClient | null)[] = [];

            function Consumer() {
                seen.push(React.useContext(WherebyContext));
                return null;
            }

            const { unmount } = render(
                <React.StrictMode>
                    <Provider client={client}>
                        <Consumer />
                    </Provider>
                </React.StrictMode>,
            );
            unmount();

            expect(seen.length).toBeGreaterThan(0);
            expect(seen.every((c) => c === client)).toBe(true);
            expect(destroySpy).not.toHaveBeenCalled();
        });

        it("lets the SDK hooks use the external client", () => {
            const client = new WherebyClient();
            const roomConnection = client.getRoomConnection();
            const subscribeSpy = jest.spyOn(roomConnection, "subscribe");
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <Provider client={client}>{children}</Provider>
            );

            const { result, unmount } = renderHook(() => useRoomConnection("https://example.whereby.com/room"), {
                wrapper,
            });

            expect(subscribeSpy).toHaveBeenCalledTimes(1);
            expect(result.current.events).toBe(roomConnection.getNotificationsEventEmitter());

            unmount();
            expect(destroySpy).not.toHaveBeenCalled();
        });

        it("destroys its own client when switched to an external one, but not the external one", () => {
            const client = new WherebyClient();
            const { seen, rerender, unmount, Consumer } = renderProvider();
            const ownClient = seen[0];

            rerender(
                <Provider client={client}>
                    <Consumer />
                </Provider>,
            );

            expect(seen[1]).toBe(client);
            expect(destroySpy).toHaveBeenCalledTimes(1);
            expect(destroySpy.mock.contexts[0]).toBe(ownClient);

            unmount();
            expect(destroySpy).toHaveBeenCalledTimes(1);
        });
    });
});
