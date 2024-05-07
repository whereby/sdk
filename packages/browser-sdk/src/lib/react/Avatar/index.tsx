import * as React from "react";

import runes from "runes";

interface AvatarProps {
    avatarUrl?: string;
    className?: string;
    variant?: "outline" | "round" | "square";
    name?: string;
    size?: 32 | 36 | 40 | 60 | 80 | 200;
}

export const getInitialsFromName = (name = "") => {
    name = name.trim();

    if (name) {
        const initials = name.split(/-| /).map((n) => runes(n)[0]);
        return initials.slice(0, 3);
    }

    return [];
};

const Initials = ({ name }: { name: string }) => {
    const initials = getInitialsFromName(name);
    const fontSize = [0, 56, 48, 40][initials.length] || 32;
    const initialsStr = initials.join("").toUpperCase();

    return (
        <svg
            viewBox={"-60 -60 120 120"}
            aria-hidden={"true"}
            style={{
                height: "100%",
                pointerEvents: "none",
                width: "100%",
            }}
        >
            <text x={0} y={0} textAnchor={"middle"} dominantBaseline={"central"} fontSize={fontSize}>
                {initialsStr}
            </text>
        </svg>
    );
};

function Avatar({ avatarUrl, className, size = 40, name, variant = "round", ...rest }: AvatarProps) {
    return (
        <div
            style={{
                height: `${size}px`,
                width: `${size}px`,
                userSelect: "none",
                overflow: "hidden",
                borderRadius: variant === "round" ? "50%" : "4px",
                backgroundColor: "#f8e3c8",
            }}
            className={className}
            title={name}
            {...rest}
        >
            {!avatarUrl && name ? (
                <Initials name={name} />
            ) : (
                <img
                    src={avatarUrl || ""}
                    alt={""}
                    style={{
                        height: "100%",
                        width: "100%",
                        objectFit: "cover",
                        maxWidth: "initial",
                    }}
                />
            )}
        </div>
    );
}

export { Avatar };
