import * as React from "react";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { css, keyframes } from "@emotion/react";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const animateIn = keyframes({
    from: {
        opacity: 1,
        transform: "scale(0.95)",
    },
});

const animateOut = keyframes({
    to: {
        opacity: 0,
        transform: "scale(0.95)",
    },
});

const popoverStyles = css({
    width: "200px",
    backgroundColor: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: "0.375rem",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    color: "#333",
    fontSize: "14px",
    lineHeight: "1.5",
    padding: "16px",
    zIndex: 50,
    outline: "none",
    "&[data-state='open']": {
        animation: `${animateIn} 0.2s ease-in-out`,
        opacity: 1,
        transform: "scale(1)",
    },
    "&[data-state='closed']": {
        animation: `${animateOut} 0.2s ease-in-out`,
        opacity: 0,
        transform: "scale(0.95)",
    },
});

const PopoverContent = React.forwardRef<
    React.ElementRef<typeof PopoverPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ align = "center", sideOffset = 4, ...rest }, ref) => (
    <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset} css={popoverStyles} {...rest} />
    </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
