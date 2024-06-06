import React, { PropsWithChildren } from "react";

import { css } from "@emotion/react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import runes from "runes";
import { useTheme } from "../theme";
import { ProfileIcon } from "../icons";

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
            <text
                fill="currentcolor"
                x={0}
                y={0}
                textAnchor={"middle"}
                dominantBaseline={"central"}
                fontSize={fontSize}
            >
                {initialsStr}
            </text>
        </svg>
    );
};

type AvatarWrapperProps = PropsWithChildren<{
    avatarUrl?: string;
    className?: string;
    name?: string;
    size?: number;
}>;

function AvatarWrapper({ className, size = 40, name, children }: AvatarWrapperProps) {
    return (
        <AvatarPrimitive.Root
            css={{
                display: "flex",
                position: "relative",
                objectFit: "cover",
                maxWidth: "initial",
                flexShrink: 0,
                overflow: "hidden",
                height: `${size}px`,
                width: `${size}px`,
                borderRadius: "15%",
            }}
            className={className}
            title={name}
        >
            {children}
        </AvatarPrimitive.Root>
    );
}

interface AvatarImageProps {
    className?: string;
    name?: string;
    avatarUrl?: string;
}

function AvatarImage({ className, name, avatarUrl }: AvatarImageProps) {
    const theme = useTheme();
    return (
        <>
            <AvatarPrimitive.Image
                css={{
                    height: "100%",
                    width: "100%",
                    maxWidth: "initial",
                    objectFit: "cover",
                }}
                src={avatarUrl}
                alt={name}
                className={className}
            />
            <AvatarPrimitive.Fallback
                css={{
                    height: "100%",
                    width: "100%",
                    backgroundColor: theme.color.brand1000,
                    color: theme.color.brand300,
                    overflow: "hidden",
                    userSelect: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                className={className}
            >
                {name ? <Initials name={name} /> : <ProfileIcon css={{ height: "50%", width: "50%" }} />}
            </AvatarPrimitive.Fallback>
        </>
    );
}

function Avatar({ className, name, avatarUrl, size }: AvatarWrapperProps & AvatarImageProps) {
    return (
        <div>
            <AvatarWrapper size={size} name={name} className={className}>
                <AvatarImage avatarUrl={avatarUrl} name={name} />
            </AvatarWrapper>
        </div>
    );
}

export { Avatar, AvatarImage, AvatarWrapper };
