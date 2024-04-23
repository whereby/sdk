import * as React from "react";

import { fitToBounds } from "@whereby.com/core";

interface Props {
    aspectRatio: number;
    children: React.ReactElement;
    className?: string;
    height: number;
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
    style,
    width,
    withRoundedCorners = false,
    withShadow = true,
    ...rest
}: Props) {
    let contentWidth = width;
    let contentHeight = height;
    let leftOffset = 0;
    let topOffset = 0;

    if (aspectRatio) {
        ({ width: contentWidth, height: contentHeight } = fitToBounds(aspectRatio, {
            width,
            height,
        }));
        // Abs center content in cell
        leftOffset = (width - contentWidth) / 2;
        topOffset = (height - contentHeight) / 2;
    }

    const contentStyle = {
        width: `${Math.round(contentWidth)}px`,
        height: `${Math.round(contentHeight)}px`,
        ...(leftOffset || topOffset
            ? { transform: `translate3d(${Math.round(leftOffset)}px, ${Math.round(topOffset)}px, 0)` }
            : {}),
    };

    return (
        <div className={className} style={style}>
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    ...contentStyle,
                }}
                {...rest}
            >
                {React.cloneElement(children, { contentWidth, contentHeight, withRoundedCorners, withShadow })}
            </div>
        </div>
    );
}

export { VideoCell };
