import * as React from "react";
import { render } from "@testing-library/react";

import { VideoStageLayout } from "../VideoStageLayout";
import { IntegrationCell } from "../IntegrationCell";
import { calculateLayout, SUBGRID_CELL_PADDING_BOX } from "../layout/stageLayout";
import { makeFrame } from "../layout/helpers";
import { CellView } from "../layout/types";

const INTEGRATION_ID = "room-integration:session-1";

const frame = makeFrame({ width: 360, height: 640 });

function cellView(cellId: string): CellView {
    return { aspectRatio: 16 / 9, cellId, clientId: cellId, type: "video" };
}

function layoutFor(
    { presentation = [], videos = [], subgrid = [] }: Record<string, string[] | undefined>,
    isConstrained: boolean,
) {
    return calculateLayout({
        frame,
        roomBounds: frame.bounds,
        gridGap: 8,
        videoGridGap: 8,
        isConstrained,
        presentationVideos: presentation.map(cellView),
        videos: videos.map(cellView),
        subgridVideos: subgrid.map(cellView),
    });
}

const Participant = ({ cellId }: { cellId: string; participant: { id: string; isPresentation: boolean } }) => (
    <div data-testid={cellId} />
);

const participant = (id: string) => <Participant key={id} cellId={id} participant={{ id, isPresentation: false }} />;

const integration = () => (
    <IntegrationCell key={INTEGRATION_ID} cellId={INTEGRATION_ID}>
        <iframe title="integration" />
    </IntegrationCell>
);

type Arrangement = { presentation?: string[]; grid?: string[]; subgrid?: string[]; hidden?: string[] };

const content = (ids: string[] = []) => ids.map((id) => (id === INTEGRATION_ID ? integration() : participant(id)));

function stage({ presentation, grid, subgrid, hidden }: Arrangement, isConstrained = false) {
    return (
        <VideoStageLayout
            containerFrame={frame}
            layoutVideoStage={layoutFor({ presentation, videos: grid, subgrid }, isConstrained)}
            isConstrained={isConstrained}
            presentationGridContent={content(presentation)}
            gridContent={content(grid)}
            subgridContent={content(subgrid)}
            hiddenContent={content(hidden)}
        />
    );
}

describe("VideoStageLayout", () => {
    it("renders an integration on a constrained stage", () => {
        const { container } = render(stage({ presentation: [INTEGRATION_ID], grid: ["alice"] }, true));

        expect(container.querySelector(`[data-cell-id="${INTEGRATION_ID}"]`)).not.toBeNull();
    });

    it("never removes or moves an integration's node as it changes area", () => {
        const onStage = { presentation: [INTEGRATION_ID], grid: ["alice"], subgrid: ["carol"] };
        const { container, rerender } = render(stage(onStage));
        const iframe = container.querySelector("iframe");
        const cell = container
            .querySelector(`[data-cell-id="${INTEGRATION_ID}"]`)!
            .closest('div[style*="position: absolute"]');

        const observer = new MutationObserver(() => {});
        observer.observe(container, { childList: true, subtree: true });

        // carol comes after the integration in the first arrangement and before it in the second,
        // which is exactly when React moves one of the two nodes
        const arrangements: Arrangement[] = [
            { grid: ["alice", "carol"], subgrid: [INTEGRATION_ID] },
            { presentation: ["alice"], grid: ["carol"], hidden: [INTEGRATION_ID] },
            onStage,
            { presentation: ["carol"], grid: ["alice"], hidden: [INTEGRATION_ID] },
            onStage,
        ];
        arrangements.forEach((arrangement) => {
            rerender(stage(arrangement));
            expect(container.querySelector("iframe")).toBe(iframe);
        });

        const removed = observer.takeRecords().flatMap((record) => Array.from(record.removedNodes));
        observer.disconnect();

        expect(removed).not.toContain(cell);
    });

    describe("in the subgrid", () => {
        // aspectRatios: each participant's camera shape, which the subgrid tile must not follow
        const subgridStage = (
            subgrid: string[],
            aspectRatios: Record<string, number>,
            bounds = { width: 1280, height: 720 },
        ) => {
            const frame = makeFrame(bounds);
            const toCellView = (id: string): CellView => ({ ...cellView(id), aspectRatio: aspectRatios[id] ?? 16 / 9 });
            const layout = calculateLayout({
                frame,
                roomBounds: frame.bounds,
                gridGap: 8,
                videoGridGap: 8,
                isConstrained: false,
                presentationVideos: ["presenter"].map(toCellView),
                videos: [],
                subgridVideos: subgrid.map(toCellView),
            });

            return (
                <VideoStageLayout
                    containerFrame={frame}
                    layoutVideoStage={layout}
                    presentationGridContent={content(["presenter"])}
                    subgridContent={content(subgrid)}
                />
            );
        };

        // The box the tile is drawn in, relative to the stage
        function tileFrame(container: HTMLElement, id: string) {
            const box = container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.parentElement!;
            const cell = box.parentElement!;
            const offset = (el: HTMLElement) => {
                const [left, top] = (el.style.transform.match(/-?[\d.]+(?=px)/g) || ["0", "0"]).map(Number);
                return { left, top };
            };

            return {
                left: offset(cell).left + offset(box).left,
                top: offset(cell).top + offset(box).top,
                width: parseFloat(box.style.width),
                height: parseFloat(box.style.height),
            };
        }

        it("draws every tile as the same avatar-sized square, whatever the camera shape", () => {
            const { container } = render(subgridStage(["alice", "bob"], { alice: 16 / 9, bob: 9 / 16 }));

            expect(tileFrame(container, "alice")).toMatchObject({ width: 80, height: 80 });
            expect(tileFrame(container, "bob")).toMatchObject({ width: 80, height: 80 });
        });

        it("keeps the cell padding clear between stacked tiles", () => {
            const { container } = render(subgridStage(["alice", "bob"], { alice: 16 / 9, bob: 16 / 9 }));
            const alice = tileFrame(container, "alice");
            const bob = tileFrame(container, "bob");

            expect(alice.left).toEqual(bob.left);
            expect(Math.abs(bob.top - alice.top) - alice.height).toEqual(
                SUBGRID_CELL_PADDING_BOX.top + SUBGRID_CELL_PADDING_BOX.bottom,
            );
        });

        it("keeps the cell padding clear between side-by-side tiles", () => {
            const { container } = render(
                subgridStage(["alice", "bob"], { alice: 16 / 9, bob: 16 / 9 }, { width: 360, height: 640 }),
            );
            const alice = tileFrame(container, "alice");
            const bob = tileFrame(container, "bob");

            expect(alice.top).toEqual(bob.top);
            expect(Math.abs(bob.left - alice.left) - alice.width).toEqual(
                SUBGRID_CELL_PADDING_BOX.left + SUBGRID_CELL_PADDING_BOX.right,
            );
        });
    });

    it("marks a displaced integration as hidden from assistive technology", () => {
        const { container } = render(stage({ presentation: ["alice"], hidden: [INTEGRATION_ID] }));

        expect(container.querySelector(`[data-cell-id="${INTEGRATION_ID}"]`)?.getAttribute("aria-hidden")).toEqual(
            "true",
        );
    });
});
