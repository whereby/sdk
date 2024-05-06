import * as React from "react";
import "./styles.css";

import { VideoStageLayout } from "../lib/react/Grid/VideoStageLayout";
// import { useWindowSize } from "../../../helpers/hooks/useWindowSize";
import { makeFrame, makeBox } from "../lib/react/Grid/layout/helpers";
import { calculateLayout } from "../lib/react/Grid/layout/stageLayout";

import { createVideoCellViews, renderCellView, NORMAL, PORTRAIT, SQUARE, WIDE } from "./components/VideoGridTestData";

interface Props {
    count: number;
    debug: boolean;
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
    isXLMeetingSize,
    numSubgridClients,
    presAspectRatios = [],
    ratios,
    ...props
}: Props) {
    // const { windowSize } = useWindowSize(isTouchDevice);
    const windowFrame = makeFrame({
        width: window.innerWidth,
        height: window.innerHeight,
        top: 0,
        left: 0,
    });
    const isConstrained = window.screen.width < 500 || window.screen.height < 500;
    const cellViewsVideoGrid = createVideoCellViews({ count, ratios });
    const gridContent = cellViewsVideoGrid.map((cellView) => renderCellView({ cellView }));
    const cellViewsSubgrid = createVideoCellViews({ count: numSubgridClients, isSubgrid: true, ratios: [WIDE] });
    const subgridContent = cellViewsSubgrid.map((cellView) => renderCellView({ cellView }));
    const cellViewsPresentationGrid = [];
    const presentationGridContent = [];

    const gridGap = 8;

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
                containerPaddings={videoStagePaddings}
                debug={debug}
                // featureRoundedCornersOn
                floatingContent={floatingContent}
                // frame={windowFrame}
                gridContent={gridContent}
                isConstrained={isConstrained}
                presentationGridContent={[]}
                subgridContent={subgridContent}
                layoutVideoStage={calculateLayout({
                    floatingVideo: cellViewsFloating[0] || null,
                    frame: windowFrame,
                    gridGap,
                    isConstrained,
                    isMaximizeMode,
                    isXLMeetingSize,
                    paddings: videoStagePaddings,
                    presentationVideos: [],
                    rebalanceLayout,
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
        floatingAspectRatio: {
            control: {
                type: "select",
                options: [null, NORMAL, WIDE, PORTRAIT],
            },
        },
        ratios: {
            control: {
                type: "multi-select",
                options: [NORMAL, WIDE, PORTRAIT],
            },
        },
    },
    args: {
        count: 0,
        debug: false,
        featureBrandAvatarsOn: false,
        floatingAspectRatio: undefined,
        isMaximizeMode: false,
        numSubgridClients: 0,
        ratios: [WIDE],
        rebalanceLayout: false,
        isXLMeetingSize: false,
    },
};

export const Empty = (args) => <SizedVideoStageLayout {...args} />;

export const TallSupersized = (args) => <SizedVideoStageLayout presAspectRatios={[PORTRAIT]} {...args} />;
TallSupersized.storyName = "Tall content supersized";

export const WideSupersized = (args) => <SizedVideoStageLayout presAspectRatios={[WIDE]} {...args} />;
WideSupersized.storyName = "Wide content supersized";

export const SquareSupersized = (args) => <SizedVideoStageLayout presAspectRatios={[SQUARE]} {...args} />;
SquareSupersized.storyName = "Square content supersized";

export const IntegrationSupersized = (args) => <SizedVideoStageLayout presAspectRatios={[undefined]} {...args} />;
IntegrationSupersized.storyName = "Integration content supersized";

export const PresentationGrid = (args) => <SizedVideoStageLayout presAspectRatios={[WIDE, PORTRAIT]} {...args} />;
PresentationGrid.storyName = "Presentation grid";
