import * as React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
}

function BaseIcon({ children, size = 24, ...props }: IconProps) {
    return (
        <svg
            xmlns={"http://www.w3.org/2000/svg"}
            viewBox={"0 0 24 24"}
            css={{
                fill: "currentcolor",
                stroke: "currentcolor",
                height: size,
                width: size,
            }}
            {...props}
        >
            {children}
        </svg>
    );
}

export { BaseIcon };
