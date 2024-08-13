import * as React from "react";
import "./styles.css";

import { VideoStageLayout } from "../lib/react/Grid/VideoStageLayout";
import { useWindowSize } from "../lib/helpers/hooks/useWindowSize";
import { makeFrame, makeBox } from "../lib/react/Grid/layout/helpers";
import { calculateLayout } from "../lib/react/Grid/layout/stageLayout";

import { createVideoCellViews, renderCellView, NORMAL, PORTRAIT, SQUARE, WIDE } from "./components/VideoGridTestData";

interface Props {
    count: number;
    debug: boolean;
    videoGridGap: number;
    floatingAspectRatio: number;
    isMaximizeMode: boolean;
    numSubgridClients: number;
    ratios: number[];
    presAspectRatios: number[];
    rebalanceLayout: boolean;
    isXLMeetingSize: boolean;
}

function SizedVideoStageLayout({
    count,
    debug,
    videoGridGap,
    isXLMeetingSize,
    numSubgridClients,
    presAspectRatios = [],
    ratios,
    ...props
}: Props) {
    const { windowSize } = useWindowSize(false);
    const windowFrame = makeFrame({
        ...windowSize,
        top: 0,
        left: 0,
    });

    const isConstrained = window.screen.width < 500 || window.screen.height < 500;
    const cellViewsVideoGrid = createVideoCellViews({ count, ratios });
    const gridContent = cellViewsVideoGrid.map((cellView) => renderCellView({ cellView }));
    const cellViewsSubgrid = createVideoCellViews({ count: numSubgridClients, isSubgrid: true, ratios: [WIDE] });
    const subgridContent = cellViewsSubgrid.map((cellView) => renderCellView({ cellView }));
    const cellViewsPresentationGrid = createVideoCellViews({
        count: presAspectRatios.length,
        ratios: presAspectRatios,
    });
    const presentationGridContent = cellViewsPresentationGrid.map((cellView) =>
        renderCellView({ cellView, isPresentation: true }),
    );

    const gridGap = 30;

    const videoStagePaddings = makeBox({
        top: gridGap,
        left: gridGap,
        bottom: gridGap,
        right: gridGap,
    });

    return (
        <div>
            <VideoStageLayout
                {...props}
                containerFrame={windowFrame}
                containerPaddings={videoStagePaddings}
                debug={debug}
                gridContent={gridContent}
                isConstrained={isConstrained}
                presentationGridContent={presentationGridContent}
                subgridContent={subgridContent}
                layoutVideoStage={calculateLayout({
                    videoGridGap,
                    frame: windowFrame,
                    gridGap,
                    isConstrained,
                    isXLMeetingSize,
                    paddings: videoStagePaddings,
                    presentationVideos: cellViewsPresentationGrid,
                    roomBounds: windowFrame.bounds,
                    subgridVideos: cellViewsSubgrid,
                    videos: cellViewsVideoGrid,
                })}
            />
        </div>
    );
}

export default {
    title: "VideoStageLayout",
    argTypes: {
        count: {
            control: { type: "range", min: 0, max: 24, step: 1 },
        },
        numSubgridClients: {
            control: { type: "range", min: 0, max: 100, step: 1 },
        },
        videoGridGap: {
            control: { type: "range", min: 0, max: 100, step: 1 },
        },
        ratios: { control: "multi-select", options: [NORMAL, WIDE, PORTRAIT] },
    },
    args: {
        count: 0,
        videoGridGap: 30,
        debug: false,
        floatingAspectRatio: undefined,
        numSubgridClients: 0,
        ratios: [WIDE],
        isXLMeetingSize: false,
    },
};

export const Empty = (args: Props) => <SizedVideoStageLayout {...args} />;

export const TallSupersized = (args: Props) => <SizedVideoStageLayout {...args} presAspectRatios={[PORTRAIT]} />;
TallSupersized.storyName = "Tall content supersized";

export const WideSupersized = (args: Props) => <SizedVideoStageLayout {...args} presAspectRatios={[WIDE]} />;
WideSupersized.storyName = "Wide content supersized";

export const SquareSupersized = (args: Props) => <SizedVideoStageLayout {...args} presAspectRatios={[SQUARE]} />;
SquareSupersized.storyName = "Square content supersized";

export const IntegrationSupersized = (args: Props) => <SizedVideoStageLayout {...args} presAspectRatios={[]} />;
IntegrationSupersized.storyName = "Integration content supersized";

export const PresentationGrid = (args: Props) => (
    <SizedVideoStageLayout {...args} presAspectRatios={[WIDE, PORTRAIT]} />
);
PresentationGrid.storyName = "Presentation grid";
