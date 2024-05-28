import * as React from "react";

import { BaseIcon, IconProps } from "./base-icon";

function Ellipsis(props: IconProps) {
    return (
        <BaseIcon {...props}>
            <g>
                <circle cx={"6"} cy={"12"} r={"2"} />
                <circle cx={"12"} cy={"12"} r={"2"} />
                <circle cx={"18"} cy={"12"} r={"2"} />
            </g>
        </BaseIcon>
    );
}

export { Ellipsis };
