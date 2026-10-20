import * as React from "react";
import { act, renderHook } from "@testing-library/react";

import { ClientView, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { useGrid } from "../useGrid";
import { FakeGridClient } from "../../../../stories/components/FakeGridClient";

const camera: ClientView = {
    id: "remote-1",
    clientId: "remote-1",
    displayName: "Remote",
    isAudioEnabled: true,
    isVideoEnabled: false,
    stream: null,
};

// A remote screenshare's view id is derived from the sharer's client id, so every share by the
// same participant gets the same id.
const screenshare: ClientView = {
    ...camera,
    id: "pres-remote-1",
    displayName: "Screenshare (Remote)",
    isPresentation: true,
};

function renderUseGrid(clientViews: ClientView[]) {
    const fakeGrid = new FakeGridClient();
    fakeGrid.setClientViews(clientViews);
    const client = { getGrid: () => fakeGrid } as unknown as WherebyClient;

    const hook = renderHook(() => useGrid(), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(WherebyContext.Provider, { value: client }, children),
    });

    return { ...hook, fakeGrid };
}

describe("useGrid", () => {
    describe("when the maximized view goes away", () => {
        it("does not maximize the next share from the same participant", () => {
            const { result, fakeGrid } = renderUseGrid([camera, screenshare]);

            act(() => result.current.setMaximizedCellId(screenshare.id));
            expect(result.current.maximizedParticipant).toBe(screenshare);

            act(() => fakeGrid.setClientViews([camera]));
            expect(result.current.maximizedCellId).toBeNull();

            act(() => fakeGrid.setClientViews([camera, { ...screenshare }]));
            expect(result.current.maximizedCellId).toBeNull();
            expect(result.current.maximizedParticipant).toBeNull();
        });

        it("keeps a maximized view that is still there", () => {
            const { result, fakeGrid } = renderUseGrid([camera, screenshare]);

            act(() => result.current.setMaximizedCellId(camera.id));
            act(() => fakeGrid.setClientViews([{ ...camera }]));

            expect(result.current.maximizedCellId).toBe(camera.id);
        });
    });

    describe("when the floating view goes away", () => {
        it("does not float the next share from the same participant", () => {
            const { result, fakeGrid } = renderUseGrid([camera, screenshare]);

            act(() => result.current.setFloatingCellId(screenshare.id));
            expect(result.current.floatingParticipant).toBe(screenshare);

            act(() => fakeGrid.setClientViews([camera]));
            act(() => fakeGrid.setClientViews([camera, { ...screenshare }]));

            expect(result.current.floatingCellId).toBeNull();
            expect(result.current.floatingParticipant).toBeNull();
        });
    });
});
