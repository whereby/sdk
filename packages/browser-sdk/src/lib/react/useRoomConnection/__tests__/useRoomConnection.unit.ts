import * as React from "react";
import { renderHook } from "@testing-library/react";

import { WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { useRoomConnection } from "..";
import { UseRoomConnectionOptions } from "../types";

const roomUrl = "https://example.whereby.com/test";

function renderUseRoomConnection(options: UseRoomConnectionOptions) {
    const roomConnection = {
        subscribe: jest.fn(() => () => undefined),
        getNotificationsEventEmitter: jest.fn(),
        initialize: jest.fn(),
        joinRoom: jest.fn(() => new Promise(() => undefined)),
        leaveRoom: jest.fn(),
    };
    const client = { getRoomConnection: () => roomConnection } as unknown as WherebyClient;

    const hook = renderHook((props: UseRoomConnectionOptions) => useRoomConnection(roomUrl, props), {
        initialProps: options,
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(WherebyContext.Provider, { value: client }, children),
    });

    return { ...hook, roomConnection };
}

describe("useRoomConnection", () => {
    describe("joinRoom", () => {
        it("joins with the options from the latest render", () => {
            const { result, rerender, roomConnection } = renderUseRoomConnection({
                displayName: "First",
                joinRoomTimeout: 60000,
            });

            rerender({ displayName: "Second", joinRoomTimeout: 1000 });
            result.current.actions.joinRoom();

            expect(roomConnection.initialize).toHaveBeenCalledWith(
                expect.objectContaining({ displayName: "Second", joinRoomTimeout: 1000 }),
            );
        });

        it("stays the same function when the options change", () => {
            const { result, rerender } = renderUseRoomConnection({ displayName: "First" });
            const { joinRoom } = result.current.actions;

            rerender({ displayName: "Second" });

            expect(result.current.actions.joinRoom).toBe(joinRoom);
        });
    });
});
