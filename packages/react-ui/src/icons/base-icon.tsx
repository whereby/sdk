import * as React from "react";

import { css } from "@emotion/react";

const style = css({
    fill: "#ccc",
});

function BaseIcon({ children, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns={"http://www.w3.org/2000/svg"} viewBox={"0 0 24 24"} css={style} {...props}>
            {children}
        </svg>
    );
}

export { BaseIcon };
