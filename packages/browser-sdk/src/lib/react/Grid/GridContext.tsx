import * as React from "react";

import { ClientView } from "@whereby.com/core";
import { CellView } from "./layout/types";

type GridContextValue = {
    onSetClientAspectRatio: ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => void;
    cellViewsVideoGrid: CellView[];
    cellViewsInPresentationGrid: CellView[];
    cellViewsInSubgrid: CellView[];
    clientAspectRatios: { [key: string]: number };
    maximizedParticipant: ClientView | null;
    setMaximizedParticipant: React.Dispatch<React.SetStateAction<ClientView | null>>;
    floatingParticipant: ClientView | null;
    setFloatingParticipant: React.Dispatch<React.SetStateAction<ClientView | null>>;
};

const GridContext = React.createContext<GridContextValue>({} as GridContextValue);

type GridCellContextValue = {
    participant: ClientView;
    isHovered: boolean;
};

const GridCellContext = React.createContext<GridCellContextValue>({} as GridCellContextValue);

const useGridCell = () => {
    const gridContext = React.useContext(GridContext);
    const gridCellContext = React.useContext(GridCellContext);

    if (!gridCellContext) {
        throw new Error("useGridCell must be used within a GridCell");
    }

    return {
        ...gridContext,
        ...gridCellContext,
    };
};

export { GridContext, GridCellContext, useGridCell };
