import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "../lib/react/Popover";

export default {
    title: "Examples/Popover",
};

export const PopoverStory = () => {
    return (
        <Popover>
            <PopoverTrigger>Open</PopoverTrigger>
            <PopoverContent>Place content for the popover here.</PopoverContent>
        </Popover>
    );
};
