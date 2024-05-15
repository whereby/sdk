import * as React from "react";

import { debounce } from "@whereby.com/core";
import { captureSafeAreaInsets } from "../safeAreaInsets";

const captureDocumentSize = () => {
    return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
    };
};

const captureDimensions = () => ({
    windowSize: captureDocumentSize(),
    safeAreaInsets: captureSafeAreaInsets(),
});

export const useWindowSize = (isTouchDevice: boolean) => {
    const [dimensions, setDimensions] = React.useState(captureDimensions());

    React.useEffect(() => {
        const handler = () => {
            const newDimensions = captureDimensions();
            setDimensions(newDimensions);
        };
        const onResize = isTouchDevice ? handler : debounce(handler, { delay: 60 });
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [isTouchDevice]);

    return dimensions;
};
