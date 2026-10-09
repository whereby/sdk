import * as React from "react";
import { act, render } from "@testing-library/react";

import { ClientView, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../Provider";
import { Grid } from "..";
import { FakeGridClient, makeFakeRoomIntegrationSession } from "../../../../stories/components/FakeGridClient";

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
});
