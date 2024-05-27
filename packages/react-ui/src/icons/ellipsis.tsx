import * as React from "react";

import { BaseIcon } from "./base-icon";

function Ellipsis({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
    return (
        <BaseIcon className={className} {...rest}>
            <g>
                <circle cx={"6"} cy={"12"} r={"2"} />
                <circle cx={"12"} cy={"12"} r={"2"} />
                <circle cx={"18"} cy={"12"} r={"2"} />
            </g>
        </BaseIcon>
    );
}

export { Ellipsis };
