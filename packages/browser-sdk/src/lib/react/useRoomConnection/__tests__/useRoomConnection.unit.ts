import * as React from "react";
import { act, renderHook } from "@testing-library/react";

import { RoomConnectionState, WherebyClient } from "@whereby.com/core";
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
    describe("joinStage", () => {
        it("is null before a join, then follows the client", () => {
            const { result, roomConnection } = renderUseRoomConnection({});
            expect(result.current.state.joinStage).toEqual(null);

            const [onStateChange] = roomConnection.subscribe.mock.calls[0] as unknown as [
                (state: Partial<RoomConnectionState>) => void,
            ];
            act(() => onStateChange({ joinStage: "signal_connect" }));

            expect(result.current.state.joinStage).toEqual("signal_connect");
        });
    });
});
