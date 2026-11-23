import * as React from "react";
import { act, renderHook } from "@testing-library/react";

import { RoomConnectionState, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { useRoomConnection } from "..";
import { UseRoomConnectionOptions } from "../types";

const roomUrl = "https://example.whereby.com/test";

type HookProps = { url: string; options: UseRoomConnectionOptions };

function renderUseRoomConnection(options: UseRoomConnectionOptions, clientState: Partial<RoomConnectionState> = {}) {
    const roomConnection = {
        subscribe: jest.fn(() => () => undefined),
        getNotificationsEventEmitter: jest.fn(),
        getState: jest.fn(() => ({ isLocked: null, ...clientState })),
        initialize: jest.fn(),
        joinRoom: jest.fn(() => new Promise(() => undefined)),
        leaveRoom: jest.fn(),
    };
    const client = { getRoomConnection: () => roomConnection } as unknown as WherebyClient;

    const hook = renderHook(({ url, options }: HookProps) => useRoomConnection(url, options), {
        initialProps: { url: roomUrl, options },
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(WherebyContext.Provider, { value: client }, children),
    });

    return { ...hook, roomConnection };
}

describe("useRoomConnection", () => {
    it("initializes the client before joining, so the room is fetched", () => {
        const { roomConnection } = renderUseRoomConnection({});

        expect(roomConnection.initialize).toHaveBeenCalledWith(expect.objectContaining({ roomUrl }));
        expect(roomConnection.joinRoom).not.toHaveBeenCalled();
    });

    it("doesn't initialize again when only the options change, as inline options do on every render", () => {
        const { rerender, roomConnection } = renderUseRoomConnection({ displayName: "First" });

        rerender({ url: roomUrl, options: { displayName: "Second" } });

        expect(roomConnection.initialize).toHaveBeenCalledTimes(1);
    });

    it("initializes again with the latest options when the room changes", () => {
        const otherRoomUrl = "https://example.whereby.com/other";
        const { rerender, roomConnection } = renderUseRoomConnection({ displayName: "First" });

        rerender({ url: otherRoomUrl, options: { displayName: "Second" } });

        expect(roomConnection.initialize).toHaveBeenCalledTimes(2);
        expect(roomConnection.initialize).toHaveBeenLastCalledWith(
            expect.objectContaining({ roomUrl: otherRoomUrl, displayName: "Second" }),
        );
    });

    describe("isLocked", () => {
        it("starts from the client's lock state, which may be known before the hook mounts", () => {
            const { result } = renderUseRoomConnection({}, { isLocked: true });

            expect(result.current.state.isLocked).toEqual(true);
        });
    });

    describe("joinRoom", () => {
        it("joins with the options from the latest render", () => {
            const { result, rerender, roomConnection } = renderUseRoomConnection({ displayName: "First" });

            rerender({ url: roomUrl, options: { displayName: "Second" } });
            result.current.actions.joinRoom();

            expect(roomConnection.initialize).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Second" }));
        });

        it("stays the same function when the options change", () => {
            const { result, rerender } = renderUseRoomConnection({ displayName: "First" });
            const { joinRoom } = result.current.actions;

            rerender({ url: roomUrl, options: { displayName: "Second" } });

            expect(result.current.actions.joinRoom).toBe(joinRoom);
        });
    });

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
