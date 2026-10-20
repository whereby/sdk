import * as React from "react";

import { fitToBounds } from "../layout/gridUtils";
import { type Box } from "../layout/types";

interface Props {
    aspectRatio: number;
    children: React.ReactElement<{
        contentWidth?: number;
        contentHeight?: number;
        withRoundedCorners?: boolean;
        withShadow?: boolean;
    }>;
    className?: string;
    height: number;
    /** Space to keep clear inside the cell. The content is fitted to what's left. */
    paddings?: Box;
    style: React.CSSProperties;
    width: number;
    withRoundedCorners: boolean;
    withShadow: boolean;
}

function VideoCell({
    aspectRatio,
    children,
    className,
    height,
    paddings,
    style,
    width,
    withRoundedCorners = false,
    withShadow = true,
    ...rest
}: Props) {
    const innerWidth = Math.max(0, width - (paddings?.left || 0) - (paddings?.right || 0));
    const innerHeight = Math.max(0, height - (paddings?.top || 0) - (paddings?.bottom || 0));
    let contentWidth = innerWidth;
    let contentHeight = innerHeight;
    let leftOffset = paddings?.left || 0;
    let topOffset = paddings?.top || 0;

    if (aspectRatio && innerWidth && innerHeight) {
        ({ width: contentWidth, height: contentHeight } = fitToBounds(aspectRatio, {
            width: innerWidth,
            height: innerHeight,
        }));
        // Abs center content in the space inside the paddings
        leftOffset += (innerWidth - contentWidth) / 2;
        topOffset += (innerHeight - contentHeight) / 2;
    }

    const contentStyle = {
        width: `${Math.round(contentWidth)}px`,
        height: `${Math.round(contentHeight)}px`,
        ...(leftOffset || topOffset
            ? { transform: `translate3d(${Math.round(leftOffset)}px, ${Math.round(topOffset)}px, 0)` }
            : {}),
    };

    return (
        <div
            className={className}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                ...style,
            }}
        >
            <div style={contentStyle} {...rest}>
                {React.cloneElement(children, { contentWidth, contentHeight, withRoundedCorners, withShadow })}
            </div>
        </div>
    );
}

export { VideoCell };
