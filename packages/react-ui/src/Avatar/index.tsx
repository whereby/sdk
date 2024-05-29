import * as React from "react";

import { css } from "@emotion/react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import runes from "runes";
import { borderRadius, colors } from "../theme";

export const getInitialsFromName = (name = "") => {
    name = name.trim();

    if (name) {
        const initials = name.split(/-| /).map((n) => runes(n)[0]);
        return initials.slice(0, 3);
    }

    return [];
};

const initialsStyles = css({
    height: "100%",
    width: "100%",
    pointerEvents: "none",
});

const Initials = ({ name }: { name?: string }) => {
    const initials = getInitialsFromName(name);
    const fontSize = [0, 56, 48, 40][initials.length] || 32;
    const initialsStr = initials.join("").toUpperCase();

    return (
        <svg viewBox={"-60 -60 120 120"} aria-hidden={"true"} css={initialsStyles}>
            <text x={0} y={0} textAnchor={"middle"} dominantBaseline={"central"} fontSize={fontSize}>
                {initialsStr}
            </text>
        </svg>
    );
};

const avatarStyles = css({
    display: "flex",
    position: "relative",
    objectFit: "cover",
    maxWidth: "initial",
    flexShrink: 0,
    overflow: "hidden",
});

const variantStyles = {
    outline: css({
        boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.12)",
    }),
    round: css({
        borderRadius: "50%",
    }),
    square: css({
        borderRadius: borderRadius.extraSmall,
    }),
};

const imageStyles = css({
    height: "100%",
    width: "100%",
    maxWidth: "initial",
    objectFit: "cover",
});

const fallbackStyles = css({
    backgroundColor: colors.backgroundYellow,
    overflow: "hidden",
    userSelect: "none",
});

interface AvatarProps {
    avatarUrl?: string;
    className?: string;
    variant?: "outline" | "round" | "square";
    name?: string;
    size?: 32 | 36 | 40 | 60 | 80 | 200;
}

function Avatar({ avatarUrl, className, size = 40, name, variant = "round", ...rest }: AvatarProps) {
    return (
        <AvatarPrimitive.Root
            css={[avatarStyles, variantStyles[variant]]}
            className={className}
            title={name}
            style={{
                height: `${size}px`,
                width: `${size}px`,
            }}
            {...rest}
        >
            <AvatarPrimitive.Image css={imageStyles} src={avatarUrl} alt={name} />
            <AvatarPrimitive.Fallback css={fallbackStyles}>
                <Initials name={name} />
            </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>
    );
}

export { Avatar };
