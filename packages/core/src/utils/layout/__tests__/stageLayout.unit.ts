import { calculateStageLayout } from "../stageLayout";
import { randomString } from "../../../__mocks__/appMocks";

const GRID_GAP_PX = 10;
const SUBGRID_CELL_PADDING = 8;
const OVERFLOW_ROOM_SUBGRID_TOP_PADDING = 20;

const SUBGRID_SIZE_OPTIONS = [80, 60, 40];
const LARGE_CELL_SIZE = SUBGRID_SIZE_OPTIONS[0] + SUBGRID_CELL_PADDING;
const MEDIUM_CELL_SIZE = SUBGRID_SIZE_OPTIONS[1] + SUBGRID_CELL_PADDING;
const SMALL_CELL_SIZE = SUBGRID_SIZE_OPTIONS[2] + SUBGRID_CELL_PADDING;

const wideScreenNoSubgrid = {
    hasOverflow: false,
    isPortrait: false,
    videosContainer: {
        bounds: {
            width: 600,
            height: 400,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: 0,
            height: 0,
        },
        contentBounds: {
            width: 0,
            height: 0,
        },
        origin: {
            top: 0,
            left: 0,
        },
        cells: expect.any(Array),
    },
};

const breakoutNoGroupNoSubgrid = {
    hasOverflow: false,
    isPortrait: true,
    videosContainer: {
        bounds: {
            width: 600,
            height: 400,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: 0,
            height: 0,
        },
        contentBounds: {
            width: 0,
            height: 0,
        },
        origin: {
            top: 0,
            left: 0,
        },
        cells: expect.any(Array),
    },
};

const wideScreenOneLargeRowSubgrid = {
    hasOverflow: false,
    isPortrait: false,
    overflowNeedBounds: {
        height: 0,
        width: 0,
    },
    videosContainer: {
        bounds: {
            width: 600 - LARGE_CELL_SIZE - GRID_GAP_PX,
            height: 400,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: LARGE_CELL_SIZE,
            height: 400,
        },
        contentBounds: {
            width: LARGE_CELL_SIZE,
            height: 400,
        },
        origin: {
            top: 0,
            left: 600 - LARGE_CELL_SIZE,
        },
        cells: expect.any(Array),
    },
};

const wideScreenOneMediumRowSubgrid = {
    hasOverflow: false,
    isPortrait: false,
    overflowNeedBounds: {
        height: 0,
        width: 0,
    },
    videosContainer: {
        bounds: {
            width: 600 - MEDIUM_CELL_SIZE - GRID_GAP_PX,
            height: 400,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: MEDIUM_CELL_SIZE,
            height: 400,
        },
        contentBounds: {
            width: MEDIUM_CELL_SIZE,
            height: 400,
        },
        origin: {
            top: 0,
            left: 600 - MEDIUM_CELL_SIZE,
        },
        cells: expect.any(Array),
    },
};

const tallScreenTwoLargeRowsSubgrid = {
    hasOverflow: false,
    isPortrait: true,
    overflowNeedBounds: {
        height: 0,
        width: 0,
    },
    videosContainer: {
        bounds: {
            width: 400,
            height: 600 - LARGE_CELL_SIZE * 2 - GRID_GAP_PX,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: 400,
            height: LARGE_CELL_SIZE * 2,
        },
        contentBounds: {
            width: 400,
            height: LARGE_CELL_SIZE * 2,
        },
        origin: {
            top: 600 - LARGE_CELL_SIZE * 2,
            left: 0,
        },
        cells: expect.any(Array),
    },
};

const tallScreenFourMediumSizeSubgrid = {
    hasOverflow: false,
    isPortrait: true,
    overflowNeedBounds: {
        height: 0,
        width: 0,
    },
    videosContainer: {
        bounds: {
            width: 400,
            height: 600 - MEDIUM_CELL_SIZE * 4 - GRID_GAP_PX,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: 400,
            height: MEDIUM_CELL_SIZE * 4,
        },
        contentBounds: {
            width: 400,
            height: MEDIUM_CELL_SIZE * 4,
        },
        origin: {
            top: 600 - MEDIUM_CELL_SIZE * 4,
            left: 0,
        },
        cells: expect.any(Array),
    },
};

const tallScreenCroppedOverflowingSmallSubgrid = {
    hasOverflow: true,
    isPortrait: true,
    overflowNeedBounds: {
        height: 324,
        width: 0,
    },
    videosContainer: {
        bounds: {
            width: 400,
            height: 300 - GRID_GAP_PX,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: 400,
            height: 624,
        },
        contentBounds: {
            width: 400,
            height: SMALL_CELL_SIZE * 13,
        },
        origin: {
            top: 300,
            left: 0,
        },
        cells: expect.any(Array),
    },
};

const tallScreenOverflowingSmallSubgrid = {
    hasOverflow: true,
    isPortrait: true,
    overflowNeedBounds: {
        height: 0,
        width: 0,
    },
    videosContainer: {
        bounds: {
            width: 400,
            height: 478 - GRID_GAP_PX - OVERFLOW_ROOM_SUBGRID_TOP_PADDING - SUBGRID_CELL_PADDING,
        },
        origin: {
            top: 0,
            left: 0,
        },
    },
    subgrid: {
        bounds: {
            width: 400,
            height: 624 + OVERFLOW_ROOM_SUBGRID_TOP_PADDING,
        },
        contentBounds: {
            width: 400,
            height: SMALL_CELL_SIZE * 13 + OVERFLOW_ROOM_SUBGRID_TOP_PADDING,
        },
        origin: {
            top: 478 - OVERFLOW_ROOM_SUBGRID_TOP_PADDING - SUBGRID_CELL_PADDING,
            left: 0,
        },
        cells: expect.any(Array),
    },
};

describe("calculateStageLayout", () => {
    it.each`
        width  | height | numSubgridClients | isConstrained | isPortrait | shouldOverflow | expectedResult
        ${600} | ${400} | ${0}              | ${true}       | ${false}   | ${false}       | ${wideScreenNoSubgrid}
        ${600} | ${400} | ${0}              | ${true}       | ${true}    | ${false}       | ${breakoutNoGroupNoSubgrid}
        ${600} | ${400} | ${4}              | ${true}       | ${false}   | ${false}       | ${wideScreenOneLargeRowSubgrid}
        ${600} | ${400} | ${4}              | ${false}      | ${false}   | ${false}       | ${wideScreenOneMediumRowSubgrid}
        ${400} | ${600} | ${8}              | ${true}       | ${true}    | ${false}       | ${tallScreenTwoLargeRowsSubgrid}
        ${400} | ${600} | ${20}             | ${true}       | ${true}    | ${false}       | ${tallScreenFourMediumSizeSubgrid}
        ${400} | ${600} | ${100}            | ${true}       | ${true}    | ${false}       | ${tallScreenCroppedOverflowingSmallSubgrid}
        ${400} | ${600} | ${100}            | ${true}       | ${true}    | ${true}        | ${tallScreenOverflowingSmallSubgrid}
    `(
        "returns expected stage layout for $numSubgridClients subgrid clients in a (w: $width, h: $height) container isConstrained:$isConstrained, isPortrait:$isPortrait, shouldOverflow:$shouldOverflow",
        ({ width, height, numSubgridClients, isConstrained, isPortrait, shouldOverflow, expectedResult }) => {
            expect(
                calculateStageLayout({
                    cellSizeOptions: isConstrained ? [80, 60, 40] : [60, 40],
                    cellPaddings: { top: 4, left: 4, bottom: 4, right: 4 },
                    containerBounds: { width, height },
                    containerOrigin: { top: 0, left: 0 },
                    isPortrait,
                    gridGap: GRID_GAP_PX,
                    hasConstrainedOverflow: false,
                    hasPresentationContent: true,
                    hasVideoContent: true,
                    maxGridWidth: 600,
                    isMaximizeMode: false,
                    isConstrained,
                    isSmallScreen: false,
                    subgridVideos: new Array(numSubgridClients).fill({ clientId: randomString("clientId") }),
                    shouldOverflowSubgrid: shouldOverflow,
                }),
            ).toEqual(expectedResult);
        },
    );
});
