import { ClientView } from "@whereby.com/core";

export type Box = {
    top: number;
    left: number;
    bottom: number;
    right: number;
};

export type Origin = {
    top: number;
    left: number;
};

export type Bounds = {
    width: number;
    height: number;
};

export type Frame = {
    origin: Origin;
    bounds: Bounds;
};

export type CellView = {
    aspectRatio?: number;
    avatarSize?: number;
    cellPaddings?: { top: number; right: number };
    client?: ClientView;
    clientId: string;
    isDraggable?: boolean;
    isPlaceholder?: boolean;
    isSubgrid?: boolean;
    type: string;
};

export type ResultCellView = {
    aspectRatio: number;
    bounds: Bounds;
    client?: ClientView;
    clientId: string;
    origin: Origin;
    isDraggable?: boolean;
    isSmallCell: boolean;
    type: string;
    paddings?: Box;
};

export type CellProps = {
    top: number;
    left: number;
    width: number;
    height: number;
};

export type CellBounds = {
    cellWidth: number;
    cellHeight: number;
    extraHorizontalPadding: number;
    extraVerticalPadding: number;
};

export type CellAspectRatio = {
    minAr: number;
    maxAr: number;
    chosenAr: number;
};

export type VideoContainerLayout = {
    isPortrait: boolean;
    presentationGrid: Frame;
    videoGrid: Frame;
};

export type CenterGridLayout = {
    cellCount: number;
    cellHeight: number;
    cellWidth: number;
    cols: number;
    rows: number;
    extraHorizontalPadding: number;
    extraVerticalPadding: number;
    gridGap: number;
    paddings: Box;
};

export type ConstrainedGridLayout = {
    cellRects: {
        origin: {
            x: number;
            y: number;
        };
        bounds: {
            width: number;
            height: number;
        };
    }[];
    cellCount: number;
    gridGap: number;
    extraHorizontalPadding: number;
    extraVerticalPadding: number;
    paddings: Box;
};

export type SubgridLayout = {
    isPortrait: boolean;
    width: number;
    height: number;
    cellBounds: Bounds;
    cellCount: number;
    rows: number;
    cols: number;
    extraHorizontalPadding: number;
    extraVerticalPadding: number;
    paddings: Box;
};

export type GridLayout = {
    videoCells: ResultCellView[];
    extraHorizontalPadding: number;
    extraVerticalPadding: number;
    paddings: Box;
    gridGap: number;
};

export type StageLayout = {
    isPortrait: boolean;
    videosContainer: Frame;
    hasOverflow: boolean;
    bounds?: Bounds;
    gridGap?: number;
    presentationGrid?: {
        bounds: Bounds;
        origin: Origin;
        cells: ResultCellView[];
        paddings: Box;
    };
    videoGrid?: {
        bounds: Bounds;
        origin: Origin;
        cells: ResultCellView[];
        paddings: Box;
    };
    floatingContent?: {
        clientId?: string;
        isDraggable?: boolean;
        origin: Origin;
        bounds: Bounds;
        aspectRatio: number;
        isSmallCell?: boolean;
    };
    subgrid: {
        bounds: Bounds;
        origin: Origin;
        cells: ResultCellView[];
        contentBounds: Bounds;
    };
    overflowNeedBounds?: Bounds;
};

export type ConstrainedLayout = {
    cellRects: {
        origin: {
            top: number;
            left: number;
            y: number;
            x: number;
        };
        bounds: Bounds;
    }[];
    layoutGrid: { lines: number[] };
    width: number;
    height: number;
    gridGap: number;
};
