import * as React from "react";

export function useIframeContract(
    ref: React.RefObject<HTMLIFrameElement | null>,
    hookName: string,
    enabled: boolean,
): void {
    React.useEffect(() => {
        if (process.env.NODE_ENV === "production" || !enabled) {
            return;
        }

        const timer = setTimeout(() => {
            const frame = ref.current;

            if (!frame) {
                console.warn(
                    `${hookName}: iframeProps.ref was never attached. Spread iframeProps onto the ` +
                        `<iframe> you render — without the ref the hook cannot tell which window is ` +
                        `answering, so nothing will ever arrive.`,
                );
                return;
            }

            if (frame.hasAttribute("sandbox")) {
                console.warn(
                    `${hookName}: the iframe has a sandbox attribute. Some integrations open their ` +
                        `own window to sign in, which a sandbox without allow-popups blocks silently.`,
                );
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [ref, hookName, enabled]);
}
