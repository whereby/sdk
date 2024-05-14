export function captureSafeAreaInsets() {
    const rootStyles = window && window.getComputedStyle(document.documentElement);
    const getPropertyValue = (property: string) =>
        (rootStyles && parseInt(rootStyles.getPropertyValue(property), 10)) || 0;

    return {
        top: getPropertyValue("--safe-area-inset-top"),
        right: getPropertyValue("--safe-area-inset-right"),
        bottom: getPropertyValue("--safe-area-inset-bottom"),
        left: getPropertyValue("--safe-area-inset-left"),
    };
}
