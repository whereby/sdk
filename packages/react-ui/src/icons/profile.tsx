import * as React from "react";

import { BaseIcon, IconProps } from "./base-icon";

function Profile(props: IconProps) {
    return (
        <BaseIcon {...props} css={{ fill: "none" }}>
            <path
                d="M3.23779 19.5C4.5632 17.2892 7.46807 15.7762 12.0001 15.7762C16.5321 15.7762 19.4369 17.2892 20.7623 19.5M15.6001 8.1C15.6001 10.0882 13.9883 11.7 12.0001 11.7C10.0118 11.7 8.40007 10.0882 8.40007 8.1C8.40007 6.11177 10.0118 4.5 12.0001 4.5C13.9883 4.5 15.6001 6.11177 15.6001 8.1Z"
                stroke-width="2"
                stroke-linecap="round"
            />
        </BaseIcon>
    );
}

export { Profile };
