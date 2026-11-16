import * as React from "react";
import { act, renderHook } from "@testing-library/react";

import { ClientView, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { useGrid } from "../useGrid";
import { FakeGridClient, makeFakeRoomIntegrationSession } from "../../../../stories/components/FakeGridClient";
import { roomIntegrationCellId } from "../layout/cellView";

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

function renderUseGrid(clientViews: ClientView[], props: Parameters<typeof useGrid>[0] = {}) {
    const fakeGrid = new FakeGridClient();
    fakeGrid.setClientViews(clientViews);
    const client = { getGrid: () => fakeGrid } as unknown as WherebyClient;

    const hook = renderHook(() => useGrid(props), {
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

describe("moveCell", () => {
    const video = (id: string): ClientView => ({
        id,
        clientId: id,
        displayName: id,
        isAudioEnabled: true,
        isVideoEnabled: true,
        stream: null,
    });
    const views = [video("a"), video("b"), video("c"), video("d")];
    const gridIds = (cells: { cellId: string }[]) => cells.map((cell) => cell.cellId);

    function setup({ spotlight = [] as string[], integrations = 0 } = {}) {
        const rendered = renderUseGrid(views, { includeIntegrations: integrations > 0 });
        const { fakeGrid } = rendered;
        act(() => {
            spotlight.forEach((id) => fakeGrid.spotlightParticipant(id));
            fakeGrid.setRunningRoomIntegrations(
                Array.from({ length: integrations }, (_, i) => makeFakeRoomIntegrationSession(i)),
            );
        });
        const reorder = jest.spyOn(fakeGrid, "reorderClientViews");
        const swapSpotlights = jest.spyOn(fakeGrid, "swapSpotlightOrder");

        return { ...rendered, reorder, swapSpotlights };
    }

    it("swaps two cells in the grid for this participant", () => {
        const { result, reorder, swapSpotlights } = setup();

        act(() => result.current.moveCell("a", "c"));

        expect(reorder).toHaveBeenCalledWith({ id: "a", withId: "c" });
        expect(swapSpotlights).not.toHaveBeenCalled();
        expect(gridIds(result.current.cellViewsVideoGrid)).toEqual(["c", "b", "a", "d"]);
        expect(result.current.maximizedCellId).toBeNull();
    });

    it("does nothing when a cell is dropped on itself", () => {
        const { result, reorder } = setup();

        act(() => result.current.moveCell("a", "a"));

        expect(reorder).not.toHaveBeenCalled();
    });

    describe("with a cell maximized", () => {
        it("moves the maximize to the target when the maximized cell is dragged", () => {
            const { result, reorder } = setup();
            act(() => result.current.setMaximizedCellId("a"));

            act(() => result.current.moveCell("a", "c"));

            expect(result.current.maximizedCellId).toBe("c");
            expect(reorder).toHaveBeenCalledWith({ id: "a", withId: "c" });
            expect(gridIds(result.current.cellViewsInPresentationGrid)).toEqual(["c"]);
            // The rest keep the swapped order (a zero-size container lays them out in the subgrid)
            expect(gridIds([...result.current.cellViewsVideoGrid, ...result.current.cellViewsInSubgrid])).toEqual([
                "b",
                "a",
                "d",
            ]);
        });

        it("moves the maximize to the dragged cell when it's dropped on the maximized one", () => {
            const { result, reorder } = setup();
            act(() => result.current.setMaximizedCellId("a"));

            act(() => result.current.moveCell("d", "a"));

            expect(result.current.maximizedCellId).toBe("d");
            expect(reorder).toHaveBeenCalledWith({ id: "d", withId: "a" });
        });

        it("keeps the maximize when two other cells swap", () => {
            const { result, reorder } = setup();
            act(() => result.current.setMaximizedCellId("a"));

            act(() => result.current.moveCell("b", "c"));

            expect(result.current.maximizedCellId).toBe("a");
            expect(reorder).toHaveBeenCalledWith({ id: "b", withId: "c" });
        });

        it("swaps a spotlighted cell locally, as the stage only shows the maximized cell", () => {
            const { result, reorder, swapSpotlights } = setup({ spotlight: ["a", "b"] });
            act(() => result.current.setMaximizedCellId("c"));

            act(() => result.current.moveCell("a", "c"));

            expect(swapSpotlights).not.toHaveBeenCalled();
            expect(reorder).toHaveBeenCalledWith({ id: "a", withId: "c" });
            expect(result.current.maximizedCellId).toBe("a");
        });
    });

    describe("with spotlights on the stage", () => {
        it("swaps the spotlights for the room", () => {
            const { result, reorder, swapSpotlights } = setup({ spotlight: ["a", "b"] });
            expect(gridIds(result.current.cellViewsInPresentationGrid)).toEqual(["a", "b"]);

            act(() => result.current.moveCell("a", "b"));

            expect(swapSpotlights).toHaveBeenCalledWith({ id: "a", withId: "b" });
            expect(reorder).not.toHaveBeenCalled();
            expect(gridIds(result.current.cellViewsInPresentationGrid)).toEqual(["b", "a"]);
        });

        it("does nothing without permission to spotlight", () => {
            const { result, fakeGrid, reorder, swapSpotlights } = setup({ spotlight: ["a", "b"] });
            fakeGrid.canSpotlight = false;

            act(() => result.current.moveCell("a", "b"));

            expect(swapSpotlights).not.toHaveBeenCalled();
            expect(reorder).not.toHaveBeenCalled();
        });

        it("does nothing when a cell moves between the stage and the grid", () => {
            const { result, reorder, swapSpotlights } = setup({ spotlight: ["a", "b"] });

            act(() => result.current.moveCell("a", "c"));
            act(() => result.current.moveCell("c", "a"));

            expect(swapSpotlights).not.toHaveBeenCalled();
            expect(reorder).not.toHaveBeenCalled();
        });

        it("still swaps cells in the grid locally", () => {
            const { result, reorder } = setup({ spotlight: ["a", "b"] });

            act(() => result.current.moveCell("c", "d"));

            expect(reorder).toHaveBeenCalledWith({ id: "c", withId: "d" });
        });
    });

    describe("with an integration on the stage", () => {
        const integrationId = roomIntegrationCellId(makeFakeRoomIntegrationSession(0));

        it("maximizes the target when the integration is dragged onto a video cell", () => {
            const { result, reorder } = setup({ integrations: 1 });
            expect(gridIds(result.current.cellViewsInPresentationGrid)).toEqual([integrationId]);

            act(() => result.current.moveCell(integrationId, "b"));

            expect(result.current.maximizedCellId).toBe("b");
            expect(reorder).not.toHaveBeenCalled();
        });

        it("maximizes the dragged cell when it's dropped on the integration", () => {
            const { result, reorder } = setup({ integrations: 1 });

            act(() => result.current.moveCell("c", integrationId));

            expect(result.current.maximizedCellId).toBe("c");
            expect(reorder).not.toHaveBeenCalled();
        });

        it("does nothing with an integration that isn't on the stage", () => {
            const { result, reorder } = setup({ integrations: 2 });
            const subgridIntegrationId = roomIntegrationCellId(makeFakeRoomIntegrationSession(1));
            expect(gridIds(result.current.cellViewsInSubgrid)).toContain(subgridIntegrationId);

            act(() => result.current.moveCell(subgridIntegrationId, "b"));
            act(() => result.current.moveCell("b", subgridIntegrationId));

            expect(result.current.maximizedCellId).toBeNull();
            expect(reorder).not.toHaveBeenCalled();
        });
    });
});
