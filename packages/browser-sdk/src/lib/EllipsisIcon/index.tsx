import * as React from "react";

function EllipsisIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={"100%"} height={"100%"} viewBox={"0 0 24 24"} xmlns={"http://www.w3.org/2000/svg"} {...props}>
            <g>
                <circle cx={"6"} cy={"12"} r={"2"} />
                <circle cx={"12"} cy={"12"} r={"2"} />
                <circle cx={"18"} cy={"12"} r={"2"} />
            </g>
        </svg>
    );
}

export { EllipsisIcon };
