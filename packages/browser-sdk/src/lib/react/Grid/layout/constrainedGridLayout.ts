import { makeBox, makeFrame } from "./helpers";
import { Box, ConstrainedGridLayout } from "./types";

const ROWS = "rows";
const COLUMNS = "columns";

function getPortraitLayoutGridForCount(count: number) {
    return (
        {
            1: { type: ROWS, lines: [1] },
            2: { type: ROWS, lines: [1, 1] },
            3: { type: ROWS, lines: [2, 1] },
            4: { type: ROWS, lines: [2, 2] },
            5: { type: ROWS, lines: [2, 2, 1] },
            6: { type: ROWS, lines: [2, 2, 2] },
            7: { type: ROWS, lines: [3, 2, 2] },
            8: { type: ROWS, lines: [2, 2, 2, 2] },
            9: { type: ROWS, lines: [3, 2, 2, 2] },
            10: { type: ROWS, lines: [3, 3, 2, 2] },
            11: { type: ROWS, lines: [3, 3, 3, 2] },
            12: { type: ROWS, lines: [3, 3, 3, 3] },
            13: { type: ROWS, lines: [2, 2, 3, 3, 3] },
            14: { type: ROWS, lines: [2, 3, 3, 3, 3] },
            15: { type: ROWS, lines: [3, 3, 3, 3, 3] },
            16: { type: ROWS, lines: [2, 2, 3, 3, 3, 3] },
            17: { type: ROWS, lines: [2, 3, 3, 3, 3, 3] },
            18: { type: ROWS, lines: [3, 3, 3, 3, 3, 3] },
            19: { type: ROWS, lines: [2, 2, 3, 3, 3, 3, 3] },
            20: { type: ROWS, lines: [2, 3, 3, 3, 3, 3, 3] },
            21: { type: ROWS, lines: [3, 3, 3, 3, 3, 3, 3] },
            22: { type: ROWS, lines: [2, 2, 3, 3, 3, 3, 3, 3] },
            23: { type: ROWS, lines: [2, 3, 3, 3, 3, 3, 3, 3] },
            24: { type: ROWS, lines: [3, 3, 3, 3, 3, 3, 3, 3] },
        }[count] || { type: ROWS, lines: [3, 3, 3, 3, 3, 3, 3, 3] }
    );
}

function getLandscapeLayoutGridForCount(count: number) {
    return (
        {
            1: { type: COLUMNS, lines: [1] },
            2: { type: COLUMNS, lines: [1, 1] },
            3: { type: COLUMNS, lines: [2, 1] },
            4: { type: COLUMNS, lines: [2, 2] },
            5: { type: ROWS, lines: [3, 2], fractions: [0.45, 0.55] },
            6: { type: COLUMNS, lines: [2, 2, 2] },
            7: { type: ROWS, lines: [4, 3], fractions: [0.45, 0.55] },
            8: { type: COLUMNS, lines: [2, 2, 2, 2] },
            9: { type: COLUMNS, lines: [3, 2, 2, 2] },
            10: { type: COLUMNS, lines: [3, 3, 2, 2] },
            11: { type: COLUMNS, lines: [3, 3, 3, 2] },
            12: { type: COLUMNS, lines: [3, 3, 3, 3] },
            13: { type: COLUMNS, lines: [4, 3, 3, 3] },
            14: { type: COLUMNS, lines: [4, 4, 3, 3] },
            15: { type: COLUMNS, lines: [3, 3, 3, 3, 3] },
            16: { type: COLUMNS, lines: [4, 3, 3, 3, 3] },
            17: { type: COLUMNS, lines: [4, 4, 3, 3, 3] },
            18: { type: COLUMNS, lines: [4, 4, 4, 3, 3] },
            19: { type: COLUMNS, lines: [4, 4, 4, 4, 3] },
            20: { type: COLUMNS, lines: [4, 4, 4, 4, 4] },
            21: { type: COLUMNS, lines: [5, 4, 4, 4, 4] },
            22: { type: COLUMNS, lines: [5, 5, 4, 4, 4] },
            23: { type: COLUMNS, lines: [5, 5, 5, 4, 4] },
            24: { type: COLUMNS, lines: [5, 5, 5, 5, 4] },
        }[count] || { type: COLUMNS, lines: [5, 5, 5, 5, 5] }
    );
}

function calcCellDimensions({
    layoutGrid,
    dim,
    secDim,
    index,
    count,
    gridGap,
}: {
    layoutGrid: { fractions?: number[]; lines: number[] };
    dim: number;
    secDim: number;
    index: number;
    count: number;
    gridGap: number;
}) {
    const adjustedDim = dim - gridGap * (count - 1);
    const cellDim = adjustedDim * (layoutGrid.fractions ? layoutGrid.fractions[index] : 1 / count);

    const secCount = layoutGrid.lines[index];
    const adjustedSecDim = secDim - gridGap * (secCount - 1);
    const secCellDim = adjustedSecDim / secCount;

    return [cellDim, secCellDim];
}

function partitionRectBy({
    isHorizontal,
    layoutGrid,
    width,
    height,
    gridGap,
}: {
    isHorizontal: boolean;
    layoutGrid: { lines: number[] };
    width: number;
    height: number;
    gridGap: number;
}) {
    const cellRects = [];
    const origin = { x: 0, y: 0 };
    const cellOrigin = { x: 0, y: 0 };
    const count = layoutGrid.lines.length;
    const dim = isHorizontal ? height : width;
    const secDim = isHorizontal ? width : height;

    for (let index = 0; index < count; index++) {
        const cellDims = calcCellDimensions({ layoutGrid, dim, secDim, index, count, gridGap });
        const width = isHorizontal ? cellDims[1] : cellDims[0];
        const height = isHorizontal ? cellDims[0] : cellDims[1];
        const cellBounds = { width, height };

        const linesCount = layoutGrid.lines[index];
        for (let lineIndex = 0; lineIndex < linesCount; lineIndex++) {
            cellRects.push({ origin: { ...cellOrigin }, bounds: cellBounds });

            if (isHorizontal) {
                cellOrigin.x += cellBounds.width + gridGap;
            } else {
                cellOrigin.y += cellBounds.height + gridGap;
            }
        }

        if (isHorizontal) {
            cellOrigin.y += cellBounds.height + gridGap;
            cellOrigin.x = origin.x;
        } else {
            cellOrigin.x += cellBounds.width + gridGap;
            cellOrigin.y = origin.y;
        }
    }
    return cellRects;
}

function partitionRectByRows({
    layoutGrid,
    width,
    height,
    gridGap,
}: {
    layoutGrid: { lines: number[] };
    width: number;
    height: number;
    gridGap: number;
}) {
    return partitionRectBy({ isHorizontal: true, layoutGrid, width, height, gridGap });
}

function partitionRectByColumns({
    layoutGrid,
    width,
    height,
    gridGap,
}: {
    layoutGrid: { lines: number[] };
    width: number;
    height: number;
    gridGap: number;
}) {
    return partitionRectBy({ isHorizontal: false, layoutGrid, width, height, gridGap });
}

function partitionRect({
    layoutGrid,
    width,
    height,
    gridGap,
}: {
    layoutGrid: { type: string; lines: number[] };
    width: number;
    height: number;
    gridGap: number;
}) {
    switch (layoutGrid.type) {
        case ROWS:
            return partitionRectByRows({ layoutGrid, width, height, gridGap });
        case COLUMNS:
            return partitionRectByColumns({ layoutGrid, width, height, gridGap });
    }
}

export function calculateLayout({
    width,
    height,
    cellCount,
    gridGap = 0,
    paddings = makeBox(),
}: {
    width: number;
    height: number;
    cellCount: number;
    gridGap?: number;
    paddings?: Box;
}) {
    const contentWidth = width - (paddings.left + paddings.right);
    const contentHeight = height - (paddings.top + paddings.bottom);

    const isPortrait = Math.round((contentWidth / contentHeight) * 10) / 10 <= 1.0;
    const layoutGrid = isPortrait
        ? getPortraitLayoutGridForCount(cellCount)
        : getLandscapeLayoutGridForCount(cellCount);
    const cellRects = partitionRect({ layoutGrid, width: contentWidth, height: contentHeight, gridGap }) || [];

    return {
        cellRects,
        cellCount,
        gridGap,
        extraHorizontalPadding: 0,
        extraVerticalPadding: 0,
        paddings,
    };
}

export function getCellPropsAtIndexForLayout({ index, layout }: { index: number; layout: ConstrainedGridLayout }) {
    const { cellRects } = layout;
    // Note: since this layout caps out at 20 cells, zero out cell instead of skipping to avoid un-mounting (will get pushed into hidden grid)
    const frame = cellRects[index] || makeFrame();

    return {
        top: frame.origin.y,
        left: frame.origin.x,
        width: frame.bounds.width,
        height: frame.bounds.height,
    };
}
