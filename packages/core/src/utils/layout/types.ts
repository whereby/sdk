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

export type ClientView = {
    id: string;
    clientId: string;
    displayName: string;
    hasActivePresentation?: boolean;
    stream?: MediaStream | null;
    isLocalClient?: boolean;
    isPresentation?: boolean;
    isVideoEnabled?: boolean;
    isAudioEnabled?: boolean;
};

export type CellView = {
    aspectRatio?: number;
    avatarSize?: number;
    cellPaddings?: number;
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
    clientId: string;
    origin: Origin;
    isDraggable?: boolean;
    isSmallCell: boolean;
    type: string;
};

export type VideoContainerLayout = {
    isPortrait: boolean;
    presentationGrid: Frame;
    videoGrid: Frame;
};

export type GridLayout = {
    videoCells: CellView[];
    extraHorizontalPadding: number;
    extraVerticalPadding: number;
    paddings: Box;
    gridGap: number;
};

export type CalculateLayoutResult = {
    isPortrait: boolean;
    hasOverflow: boolean;
    bounds: Bounds;
    gridGap: number;
    presentationGrid: {
        bounds: Bounds;
        origin: Origin;
        cells: ResultCellView[];
        paddings: Box;
    };
    videoGrid: {
        bounds: Bounds;
        origin: Origin;
        cells: ResultCellView[];
        paddings: Box;
    };
    floatingContent: {
        clientId?: string;
        isDraggable?: boolean;
        origin?: Origin;
        bounds?: Bounds;
        aspectRatio?: number;
        isSmallCell?: boolean;
    } | null;
};
