import * as React from "react";

import { css } from "@emotion/react";
import { colors } from "../theme";

const style = css({
    fill: "currentColor",
});

const sizeStyles = {
    small: css({
        width: "16px",
        height: "16px",
    }),
    medium: css({
        width: "24px",
        height: "24px",
    }),
};

const variantStyles = {
    dark: css({
        fill: colors.black,
    }),
    darkGrey: css({
        fill: colors.greyExtraDark,
    }),
    midGrey: css({
        fill: colors.grey,
    }),
    grey: css({
        fill: colors.greyExtraLight,
    }),
    light: css({
        fill: "#fff",
    }),
    lightBlue: css({
        fill: colors.illustrationBlue,
    }),
    lightGreen: css({
        fill: colors.illustrationGreen,
    }),
    primary: css({
        fill: colors.primary,
    }),
    secondary: css({
        fill: colors.secondary,
    }),
    negative: css({
        fill: colors.negative,
    }),
    meetingRed: css({
        fill: colors.meetingRed,
    }),
};

export interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: "small" | "medium";
    variant?:
        | "dark"
        | "darkGrey"
        | "midGrey"
        | "grey"
        | "light"
        | "lightBlue"
        | "lightGreen"
        | "primary"
        | "secondary"
        | "negative"
        | "meetingRed";
}

function BaseIcon({ children, size = "medium", variant = "primary", ...props }: IconProps) {
    return (
        <svg
            xmlns={"http://www.w3.org/2000/svg"}
            viewBox={"0 0 24 24"}
            css={[style, sizeStyles[size], variantStyles[variant]]}
            {...props}
        >
            {children}
        </svg>
    );
}

export { BaseIcon };
