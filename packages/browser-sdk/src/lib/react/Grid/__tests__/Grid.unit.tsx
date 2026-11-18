import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import { ClientView, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { Grid, GridCell, useGridCell } from "..";
import { FakeGridClient, makeFakeRoomIntegrationSession } from "../../../../stories/components/FakeGridClient";

function MaximizeToggle() {
    const { participant, maximizedCellId, setMaximizedCellId } = useGridCell();
    const isMaximized = maximizedCellId === participant.id;

    return (
        <button
            data-testid={`toggle-${participant.id}`}
            onClick={() => setMaximizedCellId(isMaximized ? null : participant.id)}
        >
            {isMaximized ? "Minimize" : "Maximize"}
        </button>
    );
}

// Video off, so the cells render a muted indicator rather than needing a MediaStream.
function makeParticipant(index: number): ClientView {
    return {
        id: `fake-${index}`,
        clientId: `fake-${index}`,
        displayName: `Participant ${index}`,
        isLocalClient: index === 0,
        isAudioEnabled: true,
        isVideoEnabled: false,
        stream: null,
    };
}

function renderGrid({
    numRunningIntegrations,
    spotlight,
    gridProps = {},
}: {
    numRunningIntegrations: number;
    spotlight?: string;
    gridProps?: React.ComponentProps<typeof Grid>;
}) {
    const fakeGrid = new FakeGridClient();
    fakeGrid.setClientViews([0, 1, 2].map(makeParticipant));
    if (spotlight) {
        fakeGrid.spotlightParticipant(spotlight);
    }
    fakeGrid.setRunningRoomIntegrations(
        Array.from({ length: numRunningIntegrations }, (_, i) => makeFakeRoomIntegrationSession(i)),
    );

    const client = {
        getGrid: () => fakeGrid,
        getRoomConnection: () => ({}),
        getLocalMedia: () => ({
            getState: () => ({ currentSpeakerDeviceId: "default" }),
            addListener: () => {},
            removeListener: () => {},
        }),
    } as unknown as WherebyClient;

    const result = render(
        <WherebyContext.Provider value={client}>
            <Grid {...gridProps} />
        </WherebyContext.Provider>,
    );
    // The grid measures its container through a debounced ResizeObserver callback.
    act(() => {
        jest.advanceTimersByTime(100);
    });

    return result;
}

describe("VideoGrid", () => {
    const originalResizeObserver = global.ResizeObserver;

    beforeAll(() => {
        jest.useFakeTimers();
        global.ResizeObserver = class {
            constructor(private callback: ResizeObserverCallback) {}
            observe() {
                this.callback([], this as unknown as ResizeObserver);
            }
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
        jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1280);
        jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(720);
    });

    afterAll(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        global.ResizeObserver = originalResizeObserver;
    });

    describe("by default", () => {
        it("renders a running integration in a frame", () => {
            const { container } = renderGrid({ numRunningIntegrations: 1, spotlight: "fake-1" });

            const frame = container.querySelector<HTMLIFrameElement>(
                "[data-cell-id^='room-integration'] iframe[title='Shared video 1']",
            );
            expect(frame).not.toBeNull();
            expect(frame?.src).toContain("https://integrations.whereby.dev/youtube/index.html");
            expect(frame?.src).toContain("roomintegrationsessionid=fake-session-0");
        });
    });

    describe("with enableIntegrations={false}", () => {
        it.each`
            numRunningIntegrations | enableSubgrid
            ${1}                   | ${true}
            ${1}                   | ${false}
            ${2}                   | ${true}
            ${2}                   | ${false}
        `(
            "renders as if nothing were running ($numRunningIntegrations running, enableSubgrid: $enableSubgrid)",
            ({ numRunningIntegrations, enableSubgrid }) => {
                const withRunning = renderGrid({
                    numRunningIntegrations,
                    spotlight: "fake-1",
                    gridProps: { enableSubgrid, enableIntegrations: false },
                });
                const withoutRunning = renderGrid({
                    numRunningIntegrations: 0,
                    spotlight: "fake-1",
                    gridProps: { enableSubgrid },
                });

                expect(withRunning.container.querySelector("[data-cell-id^='room-integration']")).toBeNull();
                expect(withRunning.container.innerHTML).toEqual(withoutRunning.container.innerHTML);
            },
        );
    });

    // With a spotlight on stage, the camera-off participants move to the subgrid.
    describe("in the subgrid", () => {
        // The box VideoGrid lays out for a cell's content: VideoCell's inner div, around GridCell
        const contentBox = (el: Element) => el.closest<HTMLElement>("[data-cell-id]")!.parentElement!;

        it("draws a camera-off participant's avatar at the size of the tile", () => {
            const { container } = renderGrid({ numRunningIntegrations: 0, spotlight: "fake-1" });
            const avatar = container.querySelector<HTMLElement>("[title='Participant 2']")!;
            const box = contentBox(avatar);

            expect(box.style.width).toEqual("80px");
            expect(box.style.height).toEqual("80px");
            expect(avatar.style.width).toEqual("80px");
            expect(avatar.style.height).toEqual("80px");
        });

        it("gives renderSubgridParticipant a square tile", () => {
            const { getAllByTestId } = renderGrid({
                numRunningIntegrations: 0,
                spotlight: "fake-1",
                gridProps: { renderSubgridParticipant: ({ participant }) => <div data-testid={participant.id} /> },
            });

            ["fake-0", "fake-2"].forEach((id) => {
                const box = contentBox(getAllByTestId(id)[0]);
                expect(box.style.width).toEqual("80px");
                expect(box.style.height).toEqual("80px");
            });
        });
    });

    describe("with renderIntegration", () => {
        it("renders the running integration with it instead of the default frame", () => {
            const { container, getByTestId } = renderGrid({
                numRunningIntegrations: 1,
                gridProps: {
                    renderIntegration: ({ session }) => <div data-testid={session.roomIntegrationSessionId} />,
                },
            });

            expect(getByTestId("fake-session-0")).toBeTruthy();
            expect(container.querySelector("iframe")).toBeNull();
        });
    });

    describe("with custom participant cells", () => {
        it("lets a custom cell read and change the maximized participant through useGridCell", () => {
            const { getByTestId } = renderGrid({
                numRunningIntegrations: 0,
                // Video-off participants sit in the subgrid until one is maximized onto the stage.
                gridProps: {
                    renderParticipant: () => <MaximizeToggle />,
                    renderSubgridParticipant: () => <MaximizeToggle />,
                },
            });

            expect(getByTestId("toggle-fake-1").textContent).toBe("Maximize");

            fireEvent.click(getByTestId("toggle-fake-1"));
            expect(getByTestId("toggle-fake-1").textContent).toBe("Minimize");
            expect(getByTestId("toggle-fake-2").textContent).toBe("Maximize");

            fireEvent.click(getByTestId("toggle-fake-1"));
            expect(getByTestId("toggle-fake-1").textContent).toBe("Maximize");
        });
    });

    describe("moving cells", () => {
        function MoveToFront() {
            const { participant, moveCell } = useGridCell();

            return (
                <button data-testid={`move-${participant.id}`} onClick={() => moveCell(participant.id, "fake-0")}>
                    {participant.id}
                </button>
            );
        }

        it("marks each cell with its cell id, for finding the drop target", () => {
            const { container } = renderGrid({ numRunningIntegrations: 0 });

            const cellIds = Array.from(container.querySelectorAll("[data-cell-id]")).map((el) =>
                el.getAttribute("data-cell-id"),
            );
            expect(cellIds.sort()).toEqual(["fake-0", "fake-1", "fake-2"]);
        });

        it("defaults a GridCell's data-cell-id to the participant id", () => {
            const { container } = render(<GridCell participant={makeParticipant(4)} />);

            expect(container.querySelector("[data-cell-id='fake-4']")).not.toBeNull();
        });

        it("lets a custom cell swap cells through useGridCell", () => {
            const { getByTestId, container } = renderGrid({
                numRunningIntegrations: 0,
                gridProps: {
                    enableSubgrid: false,
                    renderParticipant: () => <MoveToFront />,
                },
            });
            const order = () => Array.from(container.querySelectorAll("button")).map((el) => el.textContent);
            expect(order()).toEqual(["fake-0", "fake-1", "fake-2"]);

            fireEvent.click(getByTestId("move-fake-2"));

            expect(order()).toEqual(["fake-2", "fake-1", "fake-0"]);
        });
    });

    describe("useGridCell", () => {
        it("throws outside a GridCell", () => {
            jest.spyOn(console, "error").mockImplementation(() => {});

            expect(() => render(<MaximizeToggle />)).toThrow("useGridCell must be used within a GridCell");
        });
    });
});
