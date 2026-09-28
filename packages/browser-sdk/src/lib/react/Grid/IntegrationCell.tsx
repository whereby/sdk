import * as React from "react";

type IntegrationCellProps = {
    cellId: string;
    children: React.ReactNode;
    isHiddenCell?: boolean;
};

const IntegrationCell = ({ cellId, children, isHiddenCell = false }: IntegrationCellProps) => (
    <div data-cell-id={cellId} aria-hidden={isHiddenCell || undefined} style={{ height: "100%", width: "100%" }}>
        {children}
    </div>
);

IntegrationCell.displayName = "IntegrationCell";

export { IntegrationCell };
