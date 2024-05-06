import * as React from "react";

import { debounce } from "@whereby.com/core";
import { captureSafeAreaInsets } from "../safeAreaInsets";

const captureDocumentSize = () => {
    return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
    };
};

type Dimensions = {
    windowSize: { width: number; height: number };
    safeAreaInsets: { top: number; right: number; bottom: number; left: number };
};

const dimensionsReducer = (state: Dimensions, action: { type: "update"; newDimensions: Dimensions }) => {
    switch (action.type) {
        case "update":
            return {
                ...state,
                ...action.newDimensions,
            };
        default:
            return state;
    }
};

const captureDimensions = () => ({
    windowSize: captureDocumentSize(),
    safeAreaInsets: captureSafeAreaInsets(),
});

export const useWindowSize = (isTouchDevice: boolean) => {
    const [state, dispatch] = React.useReducer(dimensionsReducer, {}, captureDimensions);

    React.useEffect(() => {
        const handler = () => {
            const newDimensions = captureDimensions();
            dispatch({ type: "update", newDimensions });
        };
        const onResize = isTouchDevice ? handler : debounce(handler, { delay: 60 });
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [isTouchDevice]);

    return state;
};
