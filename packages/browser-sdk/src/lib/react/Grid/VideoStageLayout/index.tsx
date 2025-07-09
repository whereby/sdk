import * as React from "react";

import { VideoCell } from "../VideoCell";

import { hasBounds, makeFrame } from "../layout/helpers";
import { Bounds, Box, Frame, Origin, StageLayout } from "../layout/types";

type ContentProps = {
    props: {
        client?: { id: string };
        isSmallCell?: boolean;
        isZoomedByDefault?: boolean;
        canZoom?: boolean;
        isDraggable?: boolean;
    };
};

function generateStylesFromFrame({ origin, bounds }: { origin: Origin; bounds: Bounds }) {
    return {
        top: Math.round(origin.top),
        left: Math.round(origin.left),
        height: Math.round(bounds.height),
        width: Math.round(bounds.width),
    };
}

interface RenderVideoCellProps {
    cell: {
        bounds: Bounds;
        aspectRatio: number;
    };
    child: React.ReactElement<{
        contentWidth?: number;
        contentHeight?: number;
        withRoundedCorners?: boolean;
        withShadow?: boolean;
    }> &
        ContentProps;
    className?: string;
    clientId: string;
    style?: React.CSSProperties;
    withRoundedCorners?: boolean;
    withShadow?: boolean;
}

function renderVideoCell({
    cell,
    child,
    clientId,
    style = {},
    withRoundedCorners = false,
    withShadow = false,
}: RenderVideoCellProps) {
    const isHidden = !hasBounds(cell.bounds);
    return (
        <VideoCell
            width={cell.bounds.width}
            height={cell.bounds.height}
            aspectRatio={cell.aspectRatio}
            style={isHidden ? { width: 0, height: 0 } : style}
            withRoundedCorners={withRoundedCorners}
            withShadow={withShadow}
            key={clientId}
        >
            {child}
        </VideoCell>
    );
}

interface RenderSubgridVideoCellsProps {
    content: (React.JSX.Element | undefined)[];
    stageLayout: StageLayout;
    withRoundedCorners: boolean;
    withShadow: boolean;
}

function renderSubgridVideoCells({
    content,
    stageLayout,
    withRoundedCorners,
    withShadow,
}: RenderSubgridVideoCellsProps) {
    const cells = stageLayout.subgrid.cells;
    return content.map((child, index) => {
        const cell = cells[index];
        const style = { height: Math.round(cell.bounds.height), width: Math.round(cell.bounds.width), transform: "" };

        const origin = {
            top: stageLayout.subgrid.origin.top + cell.origin.top,
            left: stageLayout.subgrid.origin.left + cell.origin.left,
        };
        style.transform = `translate3d(${Math.round(origin.left)}px, ${Math.round(origin.top)}px, 0)`;
        const clientId = child?.props?.participant?.id;
        const leftPaddings = cell.paddings?.left || 0;
        const rightPaddings = cell.paddings?.right || 0;
        const childWithProps = React.cloneElement(child!, {
            avatarSize: cell.bounds.width - leftPaddings - rightPaddings,
            canZoom: false,
            cellPaddings: cell.paddings,
            isSmallCell: cell.isSmallCell,
            isZoomedByDefault: false,
            key: clientId || `subgrid-${index}`,
            style,
        });

        return renderVideoCell({
            cell,
            child: childWithProps,
            clientId: clientId || `subgrid-${index}`,
            style,
            withRoundedCorners,
            withShadow,
        });
    });
}

interface RenderVideoCellsProps {
    content: (React.JSX.Element | undefined)[];
    isConstrained: boolean;
    stageLayout: StageLayout;
    withRoundedCorners: boolean;
    withShadow: boolean;
}

function renderPresentationGridVideoCells({
    content,
    isConstrained,
    stageLayout,
    withRoundedCorners,
    withShadow,
}: RenderVideoCellsProps) {
    const cells = stageLayout.presentationGrid?.cells || [];
    return content.map((child, index) => {
        if (!stageLayout.presentationGrid) {
            return null;
        }
        const cell = cells[index];
        const origin = {
            top: stageLayout.presentationGrid.origin.top + stageLayout.presentationGrid.paddings.top + cell.origin.top,
            left:
                stageLayout.presentationGrid.origin.left +
                stageLayout.presentationGrid.paddings.left +
                cell.origin.left,
        };
        const style = {
            width: Math.round(cell.bounds.width),
            height: Math.round(cell.bounds.height),
            transform: `translate3d(${Math.round(origin.left)}px, ${Math.round(origin.top)}px, 0)`,
        };
        const clientId = child?.props?.participant?.id;
        const childWithProps = React.cloneElement(child!, {
            isSmallCell: cell.isSmallCell,
            isZoomedByDefault: !!isConstrained && !child?.props.participant.isPresentation,
            canZoom: !!isConstrained,
            key: clientId || `presentation-${index}`,
        });

        return renderVideoCell({
            cell,
            child: childWithProps,
            clientId: clientId || `presentation-${index}`,
            style,
            withRoundedCorners,
            withShadow,
        });
    });
}

function renderGridVideoCells({
    content,
    isConstrained,
    stageLayout,
    withRoundedCorners,
    withShadow,
}: RenderVideoCellsProps) {
    const cells = stageLayout.videoGrid?.cells || [];
    const gridVideoCells = content.map((child, index) => {
        if (!stageLayout.videoGrid) {
            return null;
        }
        const cell = cells[index];
        const origin = {
            top: stageLayout.videoGrid.origin.top + stageLayout.videoGrid.paddings.top + cell.origin.top,
            left: stageLayout.videoGrid.origin.left + stageLayout.videoGrid.paddings.left + cell.origin.left,
        };
        const style = {
            width: Math.round(cell.bounds.width),
            height: Math.round(cell.bounds.height),
            transform: `translate3d(${Math.round(origin.left)}px, ${Math.round(origin.top)}px, 0)`,
        };

        const clientId = child?.props?.participant?.id;
        const childWithProps = React.cloneElement(child!, {
            isSmallCell: cell.isSmallCell,
            isZoomedByDefault: !!isConstrained && !child?.props.participant.isPresentation,
            canZoom: !!isConstrained,
            key: clientId || `video-${index}`,
        });

        return renderVideoCell({
            cell,
            child: childWithProps,
            clientId: clientId || `video-${index}`,
            withRoundedCorners,
            style,
            withShadow,
        });
    });
    return gridVideoCells;
}

interface RenderFloatingVideoCellProps {
    content: React.ReactElement & ContentProps;
    containerFrame: Frame;
    stageLayout: StageLayout;
    withRoundedCorners: boolean;
}

function renderFloatingVideoCell({
    content,
    containerFrame,
    stageLayout,
    withRoundedCorners,
}: RenderFloatingVideoCellProps) {
    if (!stageLayout.floatingContent) {
        return null;
    }

    const cell = stageLayout.floatingContent;

    const origin = { top: cell.origin.top, left: cell.origin.left };
    const style = {
        width: Math.round(cell.bounds.width),
        height: Math.round(cell.bounds.height),
        // Convert coordinates from video stage to room layout space (to account for any safe area margins!)
        transform: `translate3d(${Math.round(containerFrame.origin.left + origin.left)}px, ${Math.round(
            containerFrame.origin.top + origin.top,
        )}px, 0)`,
        position: "fixed" as const,
        top: cell.bounds.height / 2,
        left: 0,
        zIndex: 40,
    };
    const clientId = content.props.client?.id || "floating";
    const childWithProps = React.cloneElement(content, {
        isSmallCell: cell.isSmallCell,
        isZoomedByDefault: false,
        canZoom: false,
        key: clientId,
        isDraggable: false, // override
    });

    return renderVideoCell({
        cell,
        child: childWithProps,
        clientId,
        style,
        withRoundedCorners,
        withShadow: false,
    });
}

interface VideoStageLayoutProps {
    containerFrame: Frame;
    containerPaddings?: Box;
    debug?: boolean;
    featureRoundedCornersOff?: boolean;
    floatingContent?: React.ReactElement & ContentProps;
    gridContent?: (React.JSX.Element | undefined)[];
    hiddenGridContent?: React.ReactElement[];
    hiddenPresentationGridContent?: React.ReactElement[];
    isConstrained?: boolean;
    layoutOverflowBackdropFrame?: Frame;
    layoutVideoStage: StageLayout;
    presentationGridContent?: (React.JSX.Element | undefined)[];
    subgridContent?: (React.JSX.Element | undefined)[];
}

function VideoStageLayout({
    containerFrame,
    debug = false,
    featureRoundedCornersOff = false,
    floatingContent,
    gridContent = [],
    isConstrained = false,
    layoutOverflowBackdropFrame = makeFrame(),
    layoutVideoStage: stageLayout,
    presentationGridContent = [],
    subgridContent = [],
}: VideoStageLayoutProps) {
    const withRoundedCorners = !featureRoundedCornersOff && !isConstrained;

    // Build grid cells:
    const cells = [];

    // Grid:
    if (gridContent.length) {
        cells.push(
            ...renderGridVideoCells({
                content: gridContent,
                isConstrained,
                stageLayout,
                withRoundedCorners,
                withShadow: !isConstrained,
            }),
        );
    }

    // Presentation grid:
    if (presentationGridContent.length) {
        cells.push(
            ...renderPresentationGridVideoCells({
                content: presentationGridContent,
                isConstrained,
                stageLayout,
                withRoundedCorners,
                withShadow: !isConstrained,
            }),
        );
    }

    // Floating:
    if (floatingContent) {
        cells.push(
            renderFloatingVideoCell({
                content: floatingContent,
                containerFrame,
                stageLayout,
                withRoundedCorners: !featureRoundedCornersOff,
            }),
        );
    }

    // Subgrid:
    if (subgridContent.length) {
        cells.push(
            ...renderSubgridVideoCells({
                content: subgridContent,
                stageLayout,
                withRoundedCorners: !featureRoundedCornersOff, // round even if constrained (if feature allows)
                withShadow: true,
            }),
        );
    }

    return (
        <div
            key={"video-stage-layout"}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
            }}
        >
            {hasBounds(layoutOverflowBackdropFrame.bounds) && (
                <div style={generateStylesFromFrame(layoutOverflowBackdropFrame)} />
            )}
            {cells}
            {debug && (
                <>
                    {/* <div style={generateStylesFromFrame(stageLayout.presentationGrid)} /> */}
                    {/* <div style={generateStylesFromFrame(stageLayout.videoGrid)} /> */}
                    {/* <div style={generateStylesFromFrame(stageLayout.subgrid)} /> */}
                </>
            )}
        </div>
    );
}

export { VideoStageLayout };
