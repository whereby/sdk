import * as React from "react";

import * as PopoverPrimitive from "@radix-ui/react-popover";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
    React.ElementRef<typeof PopoverPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ style, align = "center", sideOffset = 4, ...props }, ref) => (
    <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            style={{
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
                ...style,
            }}
            {...props}
        />
    </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
